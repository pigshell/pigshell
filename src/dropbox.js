/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var DropboxFS = function(opts, uri) {
    DropboxFS.base.call(this, opts, uri);
    this.metauri = 'https://api.dropbox.com/1/metadata/dropbox';
    this.bdlre = this.opts.bdlmime ? new RegExp("(.*)\\." + this.opts.bdlext + "$", "i") : null;
    this.linkre = this.opts.linkmime ? new RegExp("(.*)\\." + this.opts.linkext + "$", "i") : null;
    this.auth_handler = VFS.lookup_auth_handler("dropbox").handler;
    assert("DropboxFS.1", !!this.auth_handler);
};

inherit(DropboxFS, HttpFS);

DropboxFS.defaults = {
    "tx": "direct",
    "application/vnd.pigshell.dir": {
        "cache_time": 5 * 60 * 1000 /* 5 minutes */
    },
    dirmime: "application/vnd.pigshell.dir",
    bdlmime: "application/vnd.pigshell.bundle",
    bdlext: "bdl",
    linkmime: "application/vnd.pigshell.link",
    linkext: "href",
};

DropboxFS.rooturi = function(opts) {
    return "https://api.dropbox.com/1/metadata/dropbox/";
};

DropboxFS.prototype.access_token = function() {
    var auth = this.auth_handler.get_auth(this.opts.user);

    return (auth && auth.access_token) ? auth.access_token : 'invalid';
};


DropboxFS.lookup_uri = HttpFS.lookup_uri;

DropboxFS.prototype.dirmime = 'application/vnd.pigshell.dir';

var DropboxFile = function() {
    DropboxFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.dropboxfile';
};

inherit(DropboxFile, HttpFile);

DropboxFS.fileclass = DropboxFile;

DropboxFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        params = {'list': 'false'},
        headers = {'Authorization': 'Bearer ' + self.fs.access_token()},
        opts2 = $.extend({}, opts, {params: params, headers: headers});

    self.fs.tx.GET(self.ident, opts2, ef(cb, function(res) {
        var raw = parse_json(res.response),
            meta;

        if (!raw) {
            return cb('JSON parsing error for ' + self.ident);
        }

        meta = self._raw2meta(raw);
        if (!meta.mime) {
            return cb("Could not determine valid Dropbox mime type");
        }
        return cb(null, meta);
    }));
};

DropboxFile.prototype._raw2meta = function(raw) {
    var meta = {
            raw: raw,
            mtime: Date.parse(raw.modified),
            owner: "me",
            readable: true,
            writable: true,
            size: raw.bytes,
            ident: this.fs.metauri + raw.path,
            name: basename(raw.path)
        };

    if (raw.is_dir) {
        meta.mime = this.fs.dirmime;
        meta.etag = raw.hash;
    } else {
        meta.mime = raw.mime_type;
    }
    cookbdl(this, meta);
    return meta;
};

DropboxFile.prototype.read = function(opts, cb) {
    var self = this,
        headers = {'Authorization': 'Bearer ' + self.fs.access_token()},
        bopts = $.extend({}, opts, {headers: headers}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        uri = 'https://api-content.dropbox.com/1/files/dropbox';

    if (!mime) {
        return cb(E('ENOSYS'));
    }

    if (mime === self.fs.dirmime) {
        var etag = (opts.read && opts.read.etag) ? opts.read.etag : null;
        if (etag) {
            bopts.params = {hash: etag};
        }
        self.fs.tx.GET(self.ident, bopts, ef(cb, function(res) {
            var data = parse_json(res.response),
                meta;

            if (res.status === 304) {
                assert("DropboxFile.read.1", etag, self);
                return cb(null, {etag: etag});
            }
            if (!data || !data.contents) {
                return cb("JSON parsing error at " + self.ident);
            }
            var files;
            files = data.contents.map(function(f) {
                var meta =  self._raw2meta(f);
                return meta;
            });
            delete data["contents"];
            var dirdata = self._raw2meta(data);
            dirdata.files = files;
            return cb(null, dirdata);
        }));
    } else {
        bopts.uri = uri + self.raw.path;
        return DropboxFile.base.prototype.read.call(self, bopts, cb);
    }
};

DropboxFile.prototype.mkdir = function(filename, opts, cb) {
    var self = this,
        headers = {'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + self.fs.access_token()},
        params = {'root': 'dropbox', 'path': self.raw.path + '/' + filename},
        bopts = $.extend({}, opts, {headers: headers, params: params}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        uri = "https://api.dropbox.com/1/fileops/create_folder";

    if (mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }
    self.fs.tx.POST(uri, null, bopts, function(err, res) {
        if (err && err.code && err.code === 403) {
            return cb(E('EEXIST'));
        }
        if (err) {
            return cb(E('EINVAL'));
        }
        fstack_invaldir(self);
        return cb(null, null);
    });
};

DropboxFile.prototype.rm = function(file, opts, cb) {
    var self = this,
        headers = {'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + self.fs.access_token()},
        params = {'root': 'dropbox', 'path': pathjoin(file.raw.path)},
        bopts = $.extend({}, opts, {headers: headers, params: params}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        uri = "https://api.dropbox.com/1/fileops/delete";

    if (mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }

    self.fs.tx.POST(uri, null, bopts, function(err, res) {
        if (err && err.code && err.code === 404) {
            return cb(E('ENOENT'));
        }
        if (err) {
            return cb(E('EINVAL'));
        }
        return cb(null, null);
    });
};

DropboxFile.prototype.putdir = mkblob(function(filename, blob, opts, cb) {
    var self = this,
        headers = { 'Authorization': 'Bearer ' + self.fs.access_token() },
        params = {'root': 'dropbox', 'path': pathjoin(self.raw.path, filename)},
        bopts = $.extend({}, opts, {headers: headers, params: params}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        uri = "https://api-content.dropbox.com/1/files_put";

    if (!mime || mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }

    self.fs.tx.POST(uri, blob, bopts, ef(cb, function() {
        fstack_invaldir(self);
        return cb(null, null);
    }));
});

DropboxFile.prototype.link = function(str, linkname, opts, cb) {
    var self = this;

    if (!self.fs.opts.linkmime) {
        return cb(E("ENOSYS"));
    }
    return self.putdir(linkname + "." + self.fs.opts.linkext, str, opts, cb);
};

DropboxFS.prototype.rename = function(srcfile, srcdir, sfilename, dstdir,
    dfilename, opts, cb) {
    var self = this,
        headers = { 'Authorization': 'Bearer ' + self.access_token() },
        params = {'root': 'dropbox'},
        bopts = $.extend({}, opts, {headers: headers}),
        sfile = fstack_base(srcfile),
        ddirb = fstack_base(dstdir),
        uri = "https://api.dropbox.com/1/fileops/move";

    params['from_path'] = sfile.raw.path;
    if (self.bdlre && sfile.raw.path.match(self.bdlre)) {
        dfilename = dfilename + "." + self.opts.bdlext;
    } else if (self.linkre && sfile.raw.path.match(self.linkre)) {
        dfilename = dfilename + "." + self.opts.linkext;
    }
    params['to_path'] = pathjoin(ddirb.raw.path, dfilename);
    bopts['params'] = params;
    self.tx.POST(uri, null, bopts, function(err, res) {
        if (err && err.code && err.code === 404) {
            return cb(E('ENOENT'));
        }
        if (err) {
            return cb(E('EINVAL'));
        }
        fstack_invaldir(srcdir);
        fstack_invaldir(dstdir);
        return cb(null, null);
    });
};

VFS.register_handler("dropbox", DropboxFS);
VFS.register_uri_handler("https://api.dropbox.com/1/metadata/dropbox", "dropbox", {});

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var DropboxFS = function(opts, uri) {
    DropboxFS.base.call(this, opts, uri);
    this.metauri = 'https://api.dropbox.com/1/metadata/dropbox';
};

inherit(DropboxFS, HttpFS);

DropboxFS.defaults = {
    "tx": "direct",
    "cachedir": "true" /* Cache dir contents unless explicitly invalidated */
};

DropboxFS.prototype.access_token = function() {
    var auth = DropboxOAuth2.authdata.tokens[this.opts.user];

    return (auth && auth.access_token) ? auth.access_token : 'invalid';
};


DropboxFS.lookup_uri = HttpFS.lookup_uri;

DropboxFS.prototype.dirmime = 'application/vnd.pigshell.dir+json';
DropboxFS.prototype.bdlmime = 'application/vnd.pigshell.bundle+json';

var DropboxFile = function() {
    DropboxFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.dropboxfile';
};

inherit(DropboxFile, HttpFile);

DropboxFS.fileclass = DropboxFile;

DropboxFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        params = {'access_token': self.fs.access_token(),
            'list': 'false'},
        opts2 = $.extend({}, opts, {params: params});

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
    } else {
        meta.mime = raw.mime_type;
    }
    return meta;
};

DropboxFile.prototype.getdata = function(opts, cb) {
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
        DropboxFile.base.prototype.getdata.call(self, bopts, ef(cb, function(res) {
            to('text', res, {}, ef(cb, function(txt) {
                var data = parse_json(txt);
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
                return cb(null, JSON.stringify(dirdata));
            }));
        }));
    } else {
        bopts.uri = uri + self.raw.path;
        return DropboxFile.base.prototype.getdata.call(self, bopts, cb);
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

DropboxFile.prototype.rm = function(filename, opts, cb) {
    var self = this,
        headers = {'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + self.fs.access_token()},
        params = {'root': 'dropbox', 'path': pathjoin(self.raw.path, filename)},
        bopts = $.extend({}, opts, {headers: headers, params: params}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        uri = "https://api.dropbox.com/1/fileops/delete";

    if (mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }

    function do_delete() {
        self.fs.tx.POST(uri, null, bopts, function(err, res) {
            if (err && err.code && err.code === 404) {
                return cb(E('ENOENT'));
            }
            if (err) {
                return cb(E('EINVAL'));
            }
            fstack_invaldir(self);
            return cb(null, null);
        });
    }

    fstack_top(self).lookup(filename, opts, ef(cb, function(file) {
        if (file.mime === self.fs.dirmime) {
            file.readdir(opts, ef(cb, function(files) {
                if (Object.keys(files).length) {
                    return cb(E('ENOTEMPTY'));
                } else {
                    return do_delete();
                }
            }));
        } else {
            return do_delete(uri);
        }
    }));
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

DropboxFS.prototype.rename = function(srcfile, srcdir, sfilename, dstdir,
    dfilename, opts, cb) {
    var self = this,
        headers = { 'Authorization': 'Bearer ' + self.access_token() },
        params = {'root': 'dropbox'},
        bopts = $.extend({}, opts, {headers: headers}),
        sdirb = fstack_base(srcdir),
        ddirb = fstack_base(dstdir),
        uri = "https://api.dropbox.com/1/fileops/move";

    params['from_path'] = pathjoin(sdirb.raw.path, sfilename);
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


VFS.register_handler("DropboxFS", DropboxFS);
VFS.register_uri_handler("https://api.dropbox.com/1/metadata/dropbox", "DropboxFS", {});

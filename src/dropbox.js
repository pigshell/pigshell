/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var DropboxFS = function(opts, authuser, uri) {
    DropboxFS.base.apply(this, [opts, uri]);
    this.authuser = authuser;
    this.metauri = 'https://api.dropbox.com/1/metadata/dropbox';
    this.cachedir = true; /* Cache dir contents unless explicitly invalidated */
};

inherit(DropboxFS, HttpFS);

DropboxFS.fsname = 'DropboxFS';
DropboxFS.filesystems = [];

DropboxFS.prototype.access_token = function() {
    var auth = DropboxOAuth2.authdata.tokens[this.authuser];

    return (auth && auth.access_token) ? auth.access_token : 'invalid';
};


/* Inherit classmethods by hand */
["lookup_uri"].forEach(function(el) {
    DropboxFS[el] = DropboxFS.base[el];
});

DropboxFS.prototype.dirmime = 'application/vnd.pigshell.dir+json';
DropboxFS.prototype.bdlmime = 'application/vnd.pigshell.bundle+json';

DropboxFS.lookup_fs = function(uri, opts, cb) {
    var self = this,
        u = URI.parse(uri),
        mountopts = opts.mountopts || {};

    function create_fs(mountopts, uri) {
        var user = mountopts.user,
            auth = DropboxOAuth2.authdata.tokens[user];
        if (!auth) {
            return cb("Need to authenticate with Dropbox first");
        }
        var fs = new self(mountopts, user, uri);
        self.filesystems.push(fs);
        return cb(null, fs);
    }

    if (mountopts.tx === undefined) {
        mountopts.tx = 'direct';
    }
    if (opts.mount) {
        return create_fs(mountopts, uri);
    }
    var fs = _lookup_fs(uri, mountopts, self.filesystems);
    return fs ? cb(null, fs) : cb(null, create_fs(mountopts, uri));
};

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
        var raw = $.parseJSON(res.response),
            meta;

        if (!raw) {
            return cb('JSON parsing error for ' + self.ident);
        }

        meta = self._raw2meta(raw);
        if (!meta.mime) {
            return cb("Could not determine valid Dropbox mime type");
        }
        meta._mime_valid = true;
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
            ident: this.fs.metauri + raw.path
        };

    meta.name = basename(raw.path);
    if (raw.is_dir) {
        meta.mime = this.fs.dirmime;
    } else {
        meta.mime = raw.mime_type;
    }
    return meta;
};

DropboxFile.prototype.update = function(meta, opts, cb) {
    var self = this,
        ufile = self._ufile,
        curmime = ufile ? ufile.mime : null,
        mime;

    meta = meta || {};
    mime = meta.mime;

    if (ufile && curmime !== mime) {
        fstack_rmtop(self);
    }
    if (mime && (!self._mime_valid || curmime !== mime)) {
        mergeattr(self, meta, ["_mime_valid", "owner", "mtime", "size", "readable", "writable", "raw"]);
        var mh = VFS.lookup_media_handler(mime) ||
            VFS.lookup_media_handler('application/octet-stream');
        var mf = new mh.handler(self, meta);
        fstack_addtop(self, mf);
        return mf.update(meta, opts, cb);
    }
    mergeattr(self, meta, ["mtime", "owner", "size", "readable", "writable", "raw"]);
    return File.prototype.update.call(self, meta, opts, cb);
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
            var data = $.parseJSON(res);
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

VFS.register_uri_handler('https://api.dropbox.com/1/metadata/dropbox', DropboxFS, {}, 0);

/*
 * Copyright (C) 2012-2015 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var OneDriveFS = function(opts, uri) {
    OneDriveFS.base.call(this, opts, uri);
    this.baseuri = "https://apis.live.net/v5.0";
    this.bdlre = this.opts.bdlmime ? new RegExp("(.*)\\." + this.opts.bdlext + "$", "i") : null;
    this.linkre = this.opts.linkmime ? new RegExp("(.*)\\." + this.opts.linkext + "$", "i") : null;
    this.auth_handler = VFS.lookup_auth_handler("windows").handler;
    assert("OneDriveFS.1", !!this.auth_handler);
};

inherit(OneDriveFS, HttpFS);

OneDriveFS.defaults = {
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

OneDriveFS.prototype.access_token = function() {
    var auth = this.auth_handler.get_auth(this.opts.user);

    return (auth && auth.access_token) ? auth.access_token : 'invalid';
};

OneDriveFS.lookup_uri = HttpFS.lookup_uri;

OneDriveFS.prototype.dirmime = 'application/vnd.pigshell.dir';

var OneDriveFile = function() {
    OneDriveFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.onedrivefile';
};

inherit(OneDriveFile, HttpFile);

OneDriveFS.fileclass = OneDriveFile;

OneDriveFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        params = {"access_token": self.fs.access_token()},
        opts2 = $.extend({}, opts, {params: params});

    self.fs.tx.GET(self.ident, opts2, ef(cb, function(res) {
        var raw = parse_json(res.response),
            meta;

        if (!raw) {
            return cb('Invalid file data for ' + self.ident);
        }

        meta = self._raw2meta(raw);
        if (!meta.mime) {
            return cb("Could not determine valid OneDrive mime type");
        }
        return cb(null, meta);
    }));
};

OneDriveFile.prototype._raw2meta = function(raw) {
    var meta = {
            raw: raw,
            mtime: Date.parse(raw.updated_time),
            ctime: Date.parse(raw.created_time),
            owner: raw.from.name || "me",
            readable: true,
            writable: true,
            size: raw.size || 0,
            count: raw.count || 1,
            ident: this.fs.baseuri + "/" + raw.id,
            name: raw.name
        };

    if (raw.type === "folder" || raw.type === "album") {
        meta.mime = this.fs.dirmime;
    } else {
        meta.mime = "application/octet-stream"; // XXX Revisit
    }
    cookbdl(this, meta);
    return meta;
};

OneDriveFile.prototype.read = function(opts, cb) {
    var self = this,
        params = {"access_token": self.fs.access_token()},
        bopts = $.extend({}, opts, {params: params}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime) {
        return cb(E('ENOSYS'));
    }

    if (mime === self.fs.dirmime) {
        self.fs.tx.GET(self.ident + "/files", bopts, ef(cb, function(res) {
            var raw = parse_json(res.response),
                meta;

            if (!raw || !raw.data) {
                return cb("JSON parsing error at " + self.ident);
            }
            var files;
            files = raw.data.map(function(f) {
                var meta =  self._raw2meta(f);
                return meta;
            });
            return cb(null, {files: files});
        }));
    } else {
        bopts.uri = self.ident + "/content";
        return OneDriveFile.base.prototype.read.call(self, bopts, cb);
    }
};

OneDriveFile.prototype.mkdir = function(filename, opts, cb) {
    var self = this,
        headers = {"Content-Type": "application/json"},
        params = {"access_token": self.fs.access_token()},
        bopts = $.extend({}, opts, {params: params, headers: headers}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        data = {name: filename, description: ""};

    if (mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }
    self.fs.tx.POST(self.ident, JSON.stringify(data), bopts,
        function(err, res) {
        if (err) {
            return cb(E('EINVAL'));
        }
        fstack_invaldir(self);
        return cb(null, null);
    });
};

OneDriveFile.prototype.rm = function(file, opts, cb) {
    var self = this,
        params = {"access_token": self.fs.access_token()},
        bopts = $.extend({}, opts, {params: params}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }

    self.fs.tx.DELETE(file.ident, bopts, function(err, res) {
        if (err) {
            return cb(E('EINVAL'));
        }
        return cb(null, null);
    });
};

OneDriveFile.prototype.putdir = mkblob(function(filename, blob, opts, cb) {
    var self = this,
        // XXX WTF?! Setting a meaningful value for content type fails
        headers = {"Content-Type": " "},
        params = {"access_token": self.fs.access_token()},
        bopts = $.extend({}, opts, {params: params, headers: headers}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime || mime !== self.fs.dirmime) {
        return cb(E('ENOSYS'));
    }

    self.fs.tx.PUT(self.ident + "/files/" + filename, blob, bopts,
        ef(cb, function() {
        fstack_invaldir(self);
        return cb(null, null);
    }));
});

VFS.register_handler("OneDriveFS", OneDriveFS);
VFS.register_uri_handler("https://apis.live.net/v5.0", "OneDriveFS", {});

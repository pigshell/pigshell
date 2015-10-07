/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var GDriveFS = function(opts, uri) {
    GDriveFS.base.call(this, opts, uri);
    this.baseuri = "https://www.googleapis.com/drive/v2/files";
    this.rootraw = null;
    this.bdlre = this.opts.bdlmime ? new RegExp("(.*)\\." + this.opts.bdlext + "$", "i") : null;
    this.linkre = this.opts.linkmime ? new RegExp("(.*)\\." + this.opts.linkext + "$", "i") : null;
};

inherit(GDriveFS, HttpFS);

GDriveFS.defaults = {
    tx: "fallthrough",
    dirmime: "application/vnd.google-apps.folder",
    bdlmime: "application/vnd.pigshell.bundle",
    bdlext: "bdl",
    linkmime: "application/vnd.pigshell.link",
    linkext: "href",
    "application/vnd.google-apps.folder": {
        "cache_time": 5 * 60 * 1000 /* 5 minutes */
    },
};

GDriveFS.prototype.docmimes = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.form',
    'application/vnd.google-apps.drawing' ];
GDriveFS.prototype.officemimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];
GDriveFS.prototype.extlist = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'];
GDriveFS.prototype.rooturi = 'https://www.googleapis.com/drive/v2/files/root';
GDriveFS.prototype.synthdirs = {
    'https://www.googleapis.com/drive/v2/files/sharedWithMe': {
        'q': 'sharedWithMe',
        'name': 'Shared With Me'
    },
    'https://www.googleapis.com/drive/v2/files/trash': {
        'q': 'trashed=true',
        'name': 'Trash'
    }
};

GDriveFS.prototype.access_token = function() {
    var auth = GoogleOAuth2.authdata.tokens[this.opts.user];

    return (auth && auth.access_token) ? auth.access_token : 'invalid';
};

GDriveFS.lookup_uri = HttpFS.lookup_uri;

GDriveFS.prototype.rename = function(srcfile, srcdir, sfilename, dstdir,
    dfilename, opts, cb) {
    var self = this,
        headers = { 'Authorization': 'Bearer ' + self.access_token(),
            'Content-Type': 'application/json; charset=UTF-8' },
        bopts = $.extend({}, opts, {headers: headers}),
        sdirb = fstack_base(srcdir),
        sfb = fstack_base(srcfile),
        db = fstack_base(dstdir),
        srcdirid = sdirb.raw.id,
        dstdirid = db.raw.id,
        parents = sfb.raw.parents.map(function(p) { return { id: p.id }; }),
        uri = self.baseuri + '/' + sfb.raw.id;

    if (self.bdlre && sfb.raw.title.match(self.bdlre)) {
        dfilename = dfilename + "." + self.opts.bdlext;
    } else if (self.linkre && sfb.raw.title.match(self.linkre)) {
        dfilename = dfilename + "." + self.opts.linkext;
    }
    var meta = {title: dfilename};
    if (srcdirid !== dstdirid) {
        parents = parents.filter(function(p) { return p.id !== srcdirid; });
        parents.push({id: dstdirid});
        meta.parents = parents;
    }
    self.tx.PATCH(uri, JSON.stringify(meta), bopts, ef(cb, function() {
        fstack_invaldir(srcdir);
        fstack_invaldir(dstdir);
        return cb(null, null);
    }));
};

var GDriveFile = function() {
    GDriveFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.gdrivefile';
    /*
    this.populated = false;
    this.files = {};
    */
};

inherit(GDriveFile, HttpFile);

GDriveFS.fileclass = GDriveFile;

GDriveFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        params = {'access_token': self.fs.access_token()},
        opts2 = $.extend({}, opts, {params: params});

    if (self._is_synthuri(self.ident)) {
        var raw = self._synthraw(self.ident),
            meta = self._raw2meta(raw);
        return cb(null, meta);
    }
    self.fs.tx.GET(self.ident, opts2, ef(cb, function(res) {
        var raw = parse_json(res.response),
            meta;

        if (!raw) {
            return cb('JSON parsing error for ' + self.ident);
        }

        if (self.ident === self.fs.rooturi) {
            self.fs.rootraw = raw;
        }
        meta = self._raw2meta(raw);
        if (!meta.mime) {
            return cb("Could not determine valid GDrive mime type");
        }
        return cb(null, meta);
    }));
};

GDriveFile.prototype._raw2meta = function(raw) {
    var meta = {
        raw: raw,
        mime: raw.mimeType,
        mtime: Date.parse(raw.modifiedTime || raw.modifiedDate),
        ctime: Date.parse(raw.createdDate),
        owner: raw.owners[0].displayName,
        readable: true,
        writable: raw.editable,
        size: +raw.fileSize || 0,
        ident: raw.selfLink,
        title: raw.title
    };
    cookbdl(this, meta, "title");
    return meta;
};

/*
 * Synthesize metadata for fake directories we maintain: Shared With Me
 * and Trash
 */

GDriveFile.prototype._is_synthuri = function(uri) {
    return Object.keys(this.fs.synthdirs).indexOf(uri) !== -1;
};

GDriveFile.prototype._synthraw = function(uri) {
    var self = this,
        rootraw = self.fs.rootraw;

    if (!self._is_synthuri(uri) || !rootraw) {
        return null;
    }

    var name = self.fs.synthdirs[uri].name,
        raw = {
            title: name,
            editable: false,
            owners: rootraw.owners,
            mimeType: rootraw.mimeType,
            modifiedTime: rootraw.modifiedDate,
            createdDate: rootraw.createdDate,
            selfLink: uri,
            alternateLink: rootraw.alternateLink,
            iconLink: rootraw.iconLink
        };
    return raw;
};

GDriveFile.prototype.read = function(opts, cb) {
    var self = this,
        headers = {'Authorization': 'Bearer ' + self.fs.access_token()},
        bopts = $.extend({}, opts, {headers: headers}),
        fmt = (opts.gdrive && opts.gdrive.fmt) ? opts.gdrive.fmt : ['docx', 'xlsx', 'pptx', 'svg'],
        ropts = opts.read || {},
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (fmt && !(fmt instanceof Array)) {
        fmt = [fmt];
    }
    if (!mime) {
        return cb(E('ENOSYS'));
    }

    if (self.fs.docmimes.indexOf(mime) !== -1) {
        var exp = self.raw.exportLinks || {},
            links = Object.keys(exp).map(function(e) { return exp[e]; });

        links = links.filter(function(e) {
            var m = e.match(/exportFormat=(\S+)/);
            return (m && fmt.indexOf(m[1]) != -1);
        });
        if (links.length === 0) {
            return cb(E('ENODATA'));
        }
        bopts.uri = links[0];
        return GDriveFile.base.prototype.read.call(self, bopts, cb);
    } else if (mime === self.fs.opts.dirmime) {
        var query = self._is_synthuri(self.ident) ?
            self.fs.synthdirs[self.ident].q :
            "'" + self.raw.id + "' in parents and trashed != true",
            params = {
                "access_token": self.fs.access_token(),
                "q": query,
                "maxResults": ropts.nitems || 1000
            },
            dirstate = ropts.dirstate || {},
            opts2 = $.extend({}, opts, {params: params}),
            token;

        if (ropts.page) {
            if (ropts.page === "next") {
                if (dirstate.nextPageToken === "EOF") {
                    return cb(E("EINVAL"));
                }
                token = dirstate.nextPageToken;
            } else {
                return cb(E("EINVAL"));
            }
        } else {
            token = dirstate.currentPageToken;
        }
        if (token) {
            opts2.params.pageToken = token;
        }
        self.fs.tx.GET(self.fs.baseuri, opts2, ef(cb, function(res) {
            var data = parse_json(res.response);

            if (!data) {
                return cb('JSON parsing error for ' + self.ident);
            }
            if (self.ident === self.fs.rooturi) {
                for (var sd in self.fs.synthdirs) {
                    data.items.push(self._synthraw(sd));
                }
            }
            var files = [],
                dirstate = {};
            data.items.forEach(function(el) {
                var meta = self._raw2meta(el);
                files.push(meta);
            });
            files = unique_names(files);
            dirstate.nextPageToken = data.nextPageToken || "EOF";
            dirstate.currentPageToken = token;
            return cb(null, {dirstate: dirstate, files: files});
        }));
    } else {
        var link = self.raw.downloadUrl;

        if (!link) {
            return cb(E('ENODATA'));
        }
        bopts.uri = link;
        return GDriveFile.base.prototype.read.call(self, bopts, cb);
    }
};

var GDriveDoc = function(file) {
    GDriveDoc.base.apply(this, arguments);
    this.html = sprintf('<div class="pfile"><a href="%s" target="_blank">{{name}}</a></div>', this.ident);
};

inherit(GDriveDoc, MediaHandler);

GDriveDoc.prototype.update = function(meta, opts, cb) {
    var self = this,
        lfile = self._lfile;

    if (meta.mtime && self.mtime === meta.mtime) {
        return cb(null, self);
    }

    mergeattr(self, meta, ["mime", "mtime", "ctime", "owner", "size", "readable", "writable", "raw"]);
    self.html = '<div class="pfile gdFile"><a target="_blank" href="' + self.raw.alternateLink + '"><img src="' + self.raw.iconLink + '">{{name}}</a></div>';

    return File.prototype.update.call(self, meta, opts, cb);
};

GDriveFile.prototype.mkdir = function(filename, opts, cb) {
    var self = this,
        headers = {'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + self.fs.access_token()},
        bopts = $.extend({}, opts, {headers: headers}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (mime !== self.fs.opts.dirmime || self._is_synthuri(self.ident)) {
        return cb(E('ENOSYS'));
    }

    self.lookup(filename, opts, function(err, res) {
        if (err) {
            return gmkdir();
        } else {
            return cb(E('EEXIST'));
        }
    });

    function gmkdir() {
        var data = JSON.stringify({
            "title": filename,
            "parents": [{"id": self.raw.id}],
            "mimeType": self.fs.opts.dirmime
        });

        var tx = VFS.lookup_tx('proxy'),
            uri = self.fs.baseuri;
        self.fs.tx.POST(uri, data, bopts, function(err, res) {
            self.populated = false;
            return cb(err, res);
        });
    }
};

GDriveFile.prototype.rm = function(file, opts, cb) {
    assert("GDriveFile.rm.1", file instanceof GDriveFile, file);

    var self = this,
        headers = { 'Authorization': 'Bearer ' + self.fs.access_token() },
        bopts = {headers: headers},
        ufile = self._ufile,
        b = fstack_base(file),
        uri = self.fs.baseuri + '/' + b.raw.id + '/trash',
        mime = ufile ? ufile.mime : null;

    if (!mime || mime !== self.fs.opts.dirmime) {
        return cb(E('ENOSYS'));
    }

    if (self._is_synthuri(b.ident)) {
        return cb(E('EPERM'));
    }
    self.fs.tx.POST(uri, null, bopts, function(err) {
        if (err) {
            return cb(E('EINVAL'));
        }
        return cb(null, null);
    });
};

GDriveFile.prototype.putdir = mkblob(function(filename, blob, opts, cb) {
    var self = this,
        headers = { 'Authorization': 'Bearer ' + self.fs.access_token() },
        params = {'uploadType': 'multipart'},
        bopts = $.extend({}, opts, {headers: headers, params: params}),
        headermime = 'application/octet-stream',
        filemime = null,
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        conv = opts.gdrive ? opts.gdrive.convert : false,
        uri = "https://www.googleapis.com/upload/drive/v2/files";

    if (!mime || mime !== self.fs.opts.dirmime) {
        return cb(E('ENOSYS'));
    }

    self.lookup(filename, opts, function(err, res) {
        if (err) {
            return gputdir();
        } else {
            self.rm(filename, opts, ef(cb, gputdir));
        }
    });

    function gputdir() {
        /*
         * IF we want files to be stored as-is, then we should not ask Drive to
         * convert them. However, if we do want them to be converted and used
         * in Google Docs, there is a whole maze of twisty passages to be
         * negotiated: filename extension, convert flag, content type in
         * multipart header and mime type in metadata. What works:
         * - Keep content-type application/octet-stream regardless
         * - If filename ext is xlsx, don't set mime type, set convert flag
         *   true
         * - If filename ext isn't xlsx, but magic tells us it's xlsx, set mime
         *   to
         *   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
         *   set convert flag true
         */

        if (!conv) {
            return do_put();
        }

        var comps = filename.split("."),
            ext = (comps.length > 1) ? comps[comps.length - 1].toLowerCase() : '';

        if (ext && self.fs.extlist.indexOf(ext) !== -1) {
            bopts.params['convert'] = true;
            return do_put();
        } else {
            Magic.probe(blob, function(err, res) {
                if (self.fs.officemimes.indexOf(res) !== -1) {
                    bopts.params['convert'] = true;
                    filemime = res;
                }
                return do_put();
            });
        }
    }

    function do_put() {
        var boundary = '-------314159265358979323846',
            delimiter = "\r\n--" + boundary + "\r\n",
            close_delim = "\r\n--" + boundary + "--",
            meta = {
                "title": filename,
                "parents": [{"id": self.raw.id}]
            };

        if (filemime) {
            meta["mimeType"] = filemime;
        }
        var body = new Blob([delimiter, 
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            JSON.stringify(meta),
            delimiter,
            'Content-Type: ' + headermime + '\r\n\r\n',
            blob,
            close_delim
        ]);
        bopts.headers['Content-Type'] = 'multipart/related; boundary="' + boundary + '"';

        /*
         * API doc says we should set content-length, but OPTIONS doesn't let us
         * do so. Works nonetheless.
         */

        //bopts.headers['Content-Length'] = body.size;

        self.fs.tx.POST(uri, body, bopts, ef(cb, function(res) {
            self.populated = false;
            return cb(null, null);
        }));
    }
});

GDriveFile.prototype.link = function(str, linkname, opts, cb) {
    var self = this;

    if (!self.fs.opts.linkmime) {
        return cb(E("ENOSYS"));
    }
    return self.putdir(linkname + "." + self.fs.opts.linkext, str, opts, cb);
};

VFS.register_handler("GDriveFS", GDriveFS);
VFS.register_handler("GDriveDoc", GDriveDoc);

VFS.register_uri_handler("https://www.googleapis.com/drive/v2", "GDriveFS", {});
VFS.register_media_handler("application/vnd.google-apps.folder", "Dir", {cache_time: 5 * 60 * 1000});
VFS.register_media_handler("application/vnd.google-apps.presentation", "GDriveDoc", {});
VFS.register_media_handler("application/vnd.google-apps.spreadsheet", "GDriveDoc", {});
VFS.register_media_handler("application/vnd.google-apps.document", "GDriveDoc", {});

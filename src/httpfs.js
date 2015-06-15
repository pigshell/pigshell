/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * HttpFS is the base handler for http:// URLs. Others may subclass
 * it, e.g. ApacheDir and so forth.
 *
 * This FS also provides media handler classes for text/html, image/*.
 *
 * HttpFS is distinct from HttpTX, which provides actual GET/PUT/POST/DELETE
 * support via direct or proxy channels.
 *
 * 
 * TODO TextHtml reload
 */

var HttpFS = function(opts, uri) {
    var self = this,
        Uri = URI.parse(uri),
        host = Uri.host();

    HttpFS.base.call(this, {});
    self.uri = uri;
    self.Uri = Uri;
    self.opts = opts;
    self.tx = HttpTX.lookup(self.opts.tx);
};

inherit(HttpFS, Filesystem);

HttpFS.defaults = { "tx": "proxy" };

HttpFS.lookup_uri = function(uri, opts, cb) {
    var self = this,
        u = URI.parse(uri),
        mountopts = opts.mountopts || {},
        fs = opts.fs,
        opts2 = $.extend({}, opts);

    if (!fs) {
        try {
            fs = new self(mountopts, uri);
        } catch (e) {
            return cb(e.message);
        }
    }
    var file = new self.fileclass({name: basenamedir(uri), ident: uri, fs: fs});
    
    delete opts2['mountopts'];
    delete opts2['fs'];
    return file.stat(opts2, cb);
};

var HttpFile = function(meta) {
    HttpFile.base.call(this, mergeattr({}, meta, ["name", "ident", "fs"]));

    this.mtime = -1;
    this.size = 0;
    this.readable = true;
    this.mime = 'application/vnd.pigshell.httpfile';
    this.html = sprintf('<div class="pfile"><a href="%s" target="_blank">{{name}}</a></div>', this.ident);

    assert("HttpFile.1", this.ident !== undefined && this.name !== undefined &&
        this.fs !== undefined, this, meta);
};

inherit(HttpFile, File);

HttpFS.fileclass = HttpFile;

/*
 * Get metadata for a file, using HEAD, or in the case of a special protocol, a
 * GET with the right query parameters. Often the first operation to be invoked
 * on a new file instantiated only with ident, fs and name.
 *
 * A successful call MUST return the correct, stable mime-type of the file. It
 * SHOULD return mtime or other information to determine validity of current
 * state. It MAY return other attributes.
 *
 * This function MUST NOT update the file attributes. That is update's job.
 */

HttpFile.prototype.getmeta = function(opts, cb) {
    var self = this;

    self.fs.tx.HEAD(self.ident, opts, ef(cb, function(res) {
        var headers = header_dict(res),
            meta = self._process_headers(headers);
        return cb(null, meta);
    }));
};

/*
 * Update metadata for a file. In case of a directory, this is metadata only
 * for the directory itself, not its contents. dir.files and dir.populated
 * should be untouched.
 */

HttpFile.prototype.update = function(meta, opts, cb) {
    var self = this,
        ufile = self._ufile,
        umime = ufile ? ufile.mime : null,
        mime;

    assert("HttpFile.update.1", meta && meta.mime, meta);
    mime = meta.mime;
    //assert("HttpFile.update.2", !umime || umime === mime, self, meta);
    mergeattr_x(self, meta, ["name", "ident", "fs", "mime"]);
    if (umime !== mime) {
        if (ufile) {
            fstack_rmtop(self);
        }
        var mh = VFS.lookup_media_handler(mime) ||
            VFS.lookup_media_handler('application/octet-stream'),
            mf = new mh.handler({name: self.name, ident: self.ident,
                fs: self.fs, mime: mime}, mh.opts);
        fstack_addtop(self, mf);
        return mf.update(meta, opts, cb);
    }
    return File.prototype.update.call(self, meta, opts, cb);
};

/*
 * Retrieve file metadata and update file
 */

HttpFile.prototype.stat = function(opts, cb) {
    var self = this;
    self.getmeta(opts, ef(cb, function(meta) {
        self.update(meta, opts, cb);
    }));
};

/*
 * Retrieve file's 'data'.
 *
 * Options supported:
 *
 * range: { off: <offset>, len: <len>}
 * This will insert a range header in the GET request. The response might
 * either be the full file or the desired range. We supply the returned range
 * {off: <offset>, len: <len>, size: <size>} as the third parameter of the
 * response callback. All units are in bytes.
 *
 * Naive callers can get away with supplying an empty options, ignoring the
 * returned range, and assuming that they got the whole object.
 *
 * type: "text" | "blob"
 * Caller preference for data type, defaults to blob, not guaranteed to be
 * honoured.
 */

HttpFile.prototype.getdata = function(opts, cb) {
    var self = this,
        gopts = $.extend({}, opts),
        range = gopts.range,
        uri = opts.uri || self.ident;

    gopts["responseType"] = gopts["type"] || "blob";
    delete gopts["type"];

    if (range) {
        var offstart = range.off.toString(),
            offend = (range.len === -1) ? '' : (range.off + range.len - 1).toString();
        gopts.headers = $.extend({}, gopts.headers, {'Range':
            sprintf('bytes=%s-%s', offstart, offend)});
        delete gopts["range"];
    }

    self.fs.tx.GET(uri, gopts, ef(cb, function(res) {
        var data = res.response,
            headers = header_dict(res),
            range = {};

        if (data instanceof Blob) {
            range = {off: -1, len: data.size, size: -1};
            data.href = uri;
        } else if (isstring(data)) {
            range = {off: -1, len: data.length, size: -1};
        }
        if (headers['content-range']) {
            var m = headers['content-range'].match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
            if (m) {
                range = {off: parseInt(m[1], 10), size: parseInt(m[3], 10)};
                range.len = parseInt(m[2], 10) - range.off + 1;
            }
        }
        return cb(null, data, range);
    }));
};

/*
 * Retrieve file's 'data', but ensure that its mime-type is correct and stable
 * before doing so by forcing a stat() if necessary.
 */

HttpFile.prototype.read = function(opts, cb) {
    var self = this;
    return self.getdata(opts, cb);
};

/* Only generic, well-known attributes are returned. */
HttpFile.prototype._process_headers = function(xhr_headers) {
    var headers = xhr_headers || {},
        data = {},
        mime = xhr_getmime(headers),
        redirect = headers['x-psty-location'];

    if (redirect) {
        data.redirect_url = redirect;
    }

    if (headers['last-modified']) {
        data.mtime = Date.parse(headers['last-modified']);
    }
    if (mime !== null) {
        data.mime = mime;
    }
    if (headers['content-length']) {
        data.size = parseInt(headers['content-length'], 10);
    }
    data.readable = true;

    return data;
};

/*
 * Options taken from base FS:
 * * html_nodir: will treat text/html as plain file
 */

var TextHtml = function(meta, opts) {
    this.mime = meta.mime || "text/html";
    TextHtml.base.call(this, meta);
    this.html = sprintf('<div class="pfolder"><a href="%s" target="_blank">{{name}}</a></div>', this.ident);
    this.opts = $.extend({}, this.constructor.defaults, opts,
        this.fs.opts[this.mime]);
    if (this.opts.dir) {
        this.files = {};
        this.populated = false;
        this.readdir = this._readdir;
        this._nodescend = this.opts.nodescend;
    }
};

inherit(TextHtml, MediaHandler);

TextHtml.defaults = {
    dir: "a, img",
    nodescend: true
};

TextHtml.prototype._readdir = function(opts, cb) {
    var self = this;

    if (self.populated) {
        return cb(null, fstack_topfiles(self.files));
    }
    function makefiles(str) {
        /* Magic formula to prevent images loading by mere act of parsing */
        var str2 = str.replace(/(<img[^>]+)src=([^>]+>)/ig, '$1href=$2'),
            dom = $(str2),
            filter = self.opts.dir,
            alist = $(filter, dom),
            flist = [],
            base = URI.parse(self.redirect_url || self.ident),
            seen = {};

        alist.each(function(i, e) {
            var el = $(e),
                href = el.attr("href"),
                name = el.text().trim(),
                title = el.attr("title"),
                alt = el.attr("alt"),
                u = href ? URI.parse(href) : null,
                ident = href,
                img = el.is("img");

            img = false;

            if (!u) {
                return;
            }
            if (!u.isAbsolute()) {
                ident = base.resolve(u);
            }
            if (seen[ident.toString()]) {
                return;
            }
            seen[ident.toString()] = true;
            name = img ? basenamedir(href) : title || name || basenamedir(href);
            var file = {
                title: name,
                ident: ident,
                href: href,
                fs: self.fs
            };
            flist.push(file);
        });
        flist = unique_names(flist);
        async.forEachSeries(flist, function(el, lcb) {
            delete el['title'];
            var file = new HttpLink(el);
            file.update(el, opts, function(err, res) {
                if (!err) {
                    self.files[el.name] = res;
                }
                return lcb(null);
            });
        }, function(err) {
            self.populated = true;
            return cb(null, fstack_topfiles(self.files));
        });
    }

    self.read(opts, ef(cb, function(res) {
        to('text', res, {}, ef(cb, function(txt) {
            return makefiles(txt);
        }));
    }));
};

TextHtml.prototype.update = function(meta, opts, cb) {
    var self = this;

    if (meta.mtime !== undefined && self.mtime !== meta.mtime) {
        self.populated = false;
        self.files = {};
    }
    mergeattr_x(self, meta, ["name", "ident", "fs", "mime", "populated", "files"]);
    return File.prototype.update.call(self, meta, opts, cb);
};

TextHtml.prototype.bundle = function(opts, cb) {
    var self = this;

    function do_dump(str) {
        var $ = $$.load(str),
            data = {},
            rsrc = {},
            base = URI.parse(self.redirect_url || self.ident),
            elist = $('link, img, script').toArray();

        var dotmeta = {
            'version': '1.0',
            'origin': self.redirect_url || self.ident,
            'meta': { 
                'mime': 'text/html',
                'mtime': self.mtime
            }
        };
        async.forEachSeries(elist, function(el, lcb) {
            var e = $(el),
                ua = e.is('link') ? 'href' : 'src',
                a = e.attr(ua),
                aobj = this;
             
            if (a) {
                var uri = base.resolve(a),
                    turi = URI.parse(a),
                    tname;
                turi.setQuery('').setFragment('');
                tname = turi.toString().replace(/\//g, '_');

                VFS.lookup_uri(uri, {}, function(err, res) {
                    if (!err) {
                        rsrc[tname] = res;
                        e.attr(ua, '.rsrc/' + a.replace(/\//g, '_'));
                    }
                    return soguard(self, lcb.bind(aobj, null));
                });
            } else {
                return soguard(self, lcb.bind(aobj, null));
            }
        }, function(err) {
            if (Object.keys(rsrc).length) {
                data['.rsrc'] = rsrc;
                dotmeta['data'] = { 'type': 'file',
                    'value': self.name
                };
                data['.meta'] = JSON.stringify(dotmeta, null, "  ");
                data[self.name] = $.html();
            } else {
                data = str;
            }
            return cb(null, data);
        });
    }

    self.read({context: opts.context, type: "text"}, ef(cb, function(res) {
        return do_dump(res);
    }));
};

var HttpLink = function(file) {
    this.mtime = -1;
    this.files = {};
    this.readable = true;

    HttpLink.base.apply(this, arguments);
    this.html = sprintf('<div class="pfile"><a href="%s" target="_blank">{{name}}', this.ident, this.ident);
    assert("HttpLink.1", this.ident !== undefined && this.name !== undefined &&
        this.fs !== undefined, this);
};

inherit(HttpLink, File);

HttpLink.prototype.update = function(meta, opts, cb) {
    var self = this;

    if (meta.mtime !== undefined && self.mtime !== meta.mtime) {
        fstack_rmtop(self);
    }
    mergeattr_x(self, meta, ["name", "ident", "fs", "mime"]);
    return cb(null, self);
};

["read", "readdir", "lookup", "search"].forEach(function(op) {
    HttpLink.prototype[op] = function() {
        var self = this,
            args = [].slice.call(arguments),
            u = URI.parse(self.href),
            fso = u.isAbsolute() ? {} : {fs: self.fs},
            opts = (op === "read" || op === "readdir") ? args[0] : args[1],
            opts2 = $.extend({}, opts, fso),
            cb = args[args.length - 1],
            uri = u.isAbsolute() ? self.href : self.ident;

        // YYY hack re href/ident - fix!
        return VFS.lookup_uri(uri, opts2, ef(cb, function(res) {
            fstack_addtop(self, fstack_base(res));
            var tfile = fstack_top(self);
            return tfile[op] ? tfile[op].apply(tfile, args) : cb(E('ESTACKMOD'));
        }));
    };
});

pigshell.HttpFS = HttpFS;

VFS.register_handler("HttpFS", HttpFS);
VFS.register_handler("MediaHandler", MediaHandler);
VFS.register_handler("TextHtml", TextHtml);
VFS.register_handler("HttpLink", HttpLink);

VFS.register_uri_handler("http", "HttpFS", {});
VFS.register_uri_handler("https", "HttpFS", {});

VFS.register_uri_handler("http://pigshell.com", "HttpFS", {"tx": "direct"});
VFS.register_uri_handler("https://pigshell.com", "HttpFS", {"tx": "direct"});

VFS.register_media_handler("text/html", "TextHtml", {});
VFS.register_media_handler("text/vnd.pigshell.html+dir", "TextHtml", {"nodescend": false});
VFS.register_media_handler("application/octet-stream", "MediaHandler", {});

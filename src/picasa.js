/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var PicasaFS = function(opts, uri) {
    PicasaFS.base.call(this, opts, uri);
    this.auth_handler = VFS.lookup_auth_handler("google").handler;
    assert("PicasaFS.1", !!this.auth_handler);
};

inherit(PicasaFS, HttpFS);

PicasaFS.defaults = { "tx": "direct" };
PicasaFS.lookup_uri = HttpFS.lookup_uri;

PicasaFS.rooturi = function(opts) {
    var ainfo = VFS.lookup_auth_handler("google").handler.get_auth(opts.user),
        userinfo = ainfo.userinfo,
        rooturi = "https://picasaweb.google.com/data/feed/api/user/" +
            userinfo.id + "/";
    return rooturi;
};

PicasaFS.prototype.access_token = function() {
    var auth = this.auth_handler.get_auth(this.opts.user);

    return (auth && auth.access_token) ? auth.access_token : 'invalid';
};

var PicasaFile = function() {
    PicasaFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.picasafile';
    this.populated = false;
    this.files = {};
};

inherit(PicasaFile, HttpFile);

PicasaFS.fileclass = PicasaFile;

PicasaFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        params = {'alt': 'json', 'access_token': self.fs.access_token(),
            'imgmax': 'd'},
        opts2 = $.extend({}, opts, {params: params});

    self.fs.tx.GET(self.ident, opts2, ef(cb, function(res) {
        var headers = header_dict(res),
            data = parse_json(res.response),
            meta = {};

        if (!data) {
            return cb('JSON parsing error for ' + self.ident);
        }
        if (data.error) {
            return cb(data.error);
        }

        if (headers['last-modified']) {
            meta.mtime = Date.parse(headers['last-modified']);
        }
        meta.raw = data.entry || data.feed;
        meta.mime = picasa_getmime(meta.raw);
        if (!meta.mime) {
            return cb("Could not determine valid Picasa mime type");
        }
        return cb(null, meta);
    }));
};

PicasaFile.prototype.read = function(opts, cb) {
    var self = this,
        bopts = $.extend({}, opts),
        params = {'alt': 'json', 'access_token': self.fs.access_token()},
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime) {
        return cb(E('ENOSYS'));
    }

    if (mime === 'application/vnd.pigshell.picasa.photo') {
        bopts.uri = ufile.raw.media$group.media$content[0].url;
        return PicasaFile.base.prototype.read.call(self, bopts, cb);
    } else if (mime === 'application/vnd.pigshell.picasa.album') {
        params['imgmax'] = 'd';
    }

    bopts.params = $.extend({}, bopts.params, params);

    bopts.uri = picasa_getlink(ufile.raw,
        "http://schemas.google.com/g/2005#feed");
    if (!bopts.uri) {
        return cb("No feed URI in metadata");
    }
    return PicasaFile.base.prototype.read.call(self, bopts, cb);
};

PicasaFile.prototype.mkdir = function(filename, opts, cb) {
    var self = this,
        headers = {'Content-Type': 'application/atom+xml',
            'GData-Version': '2',
            'Authorization': 'Bearer ' + self.fs.access_token()},
        bopts = $.extend({}, opts, {headers: headers}),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (mime !== 'application/vnd.pigshell.picasa.user') {
        return cb(E('ENOSYS'));
    }

    var uri = picasa_getlink(ufile.raw,
        "http://schemas.google.com/g/2005#feed");

    var data = [
            "<entry xmlns='http://www.w3.org/2005/Atom'",
            "xmlns:media='http://search.yahoo.com/mrss/'",
            "xmlns:gphoto='http://schemas.google.com/photos/2007'>",
            "<title type='text'>",filename,"</title>",
            "<summary type='text'>",filename,"</summary>",
            "<gphoto:access>protected</gphoto:access>",
            "<gphoto:timestamp>",Date.now(),"</gphoto:timestamp>",
            "<category scheme='http://schemas.google.com/g/2005#kind' ",
            "term='http://schemas.google.com/photos/2007#album'></category>",
            "</entry>"
            ].join(" ");

    var tx = VFS.lookup_tx('proxy');
    tx.POST(uri, data, bopts, function(err, res) {
        self.populated = false;
        return cb(err, res);
    });
};

PicasaFile.prototype.rm = function(filename, opts, cb) {
    var self = this,
        headers = {'GData-Version': '2',
            'Authorization': 'Bearer ' + self.fs.access_token(),
            'If-Match': '*'},
        bopts = {headers: headers},
        tx = VFS.lookup_tx('proxy'),
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime) {
        return cb(E('ENOSYS'));
    }

    function rmfile(ident) {
        tx.DELETE(ident, bopts, function(err, res) {
            if (!err) {
                self.populated = false;
            }
            return cb(err, res);
        });
    }

    ufile.lookup(filename, opts, ef(cb, function(file) {
        if (file.mime === 'application/vnd.pigshell.picasa.album') {
            file.readdir(opts, ef(cb, function(files) {
                if (Object.keys(files).length) {
                    return cb(E('ENOTEMPTY'));
                }
                return rmfile(file.ident);
            }));
        } else if (file.mime === 'application/vnd.pigshell.picasa.photo') {
            return rmfile(file.ident);
        } else {
            return cb(E('ENOSYS'));
        }
    }));
};

PicasaFile.prototype.putdir = mkblob(function(filename, blob, opts, cb) {
    var self = this,
        headers = {'GData-Version': '2',
            'Authorization': 'Bearer ' + self.fs.access_token(),
            'Slug': filename},
        bopts = $.extend({}, opts, {headers: headers}),
        tx = VFS.lookup_tx('proxy'),
        valid = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'],
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime || mime !== 'application/vnd.pigshell.picasa.album') {
        return cb(E('ENOSYS'));
    }
    Magic.probe(blob, function(err, res) {
        if (err || valid.indexOf(res) === -1) {
            return cb(E('EINVAL'));
        }
        if (res !== blob.type) {
            blob = new Blob([blob], {type: res});
        }
        var uri = picasa_getlink(ufile.raw,
            "http://schemas.google.com/g/2005#feed");
        tx.POST(uri, blob, bopts, ef(cb, function(res) {
            self.populated = false;
            return cb(null, null);
        }));
    });
});

var PicasaUser = function(file) {
    this.mime = 'application/vnd.pigshell.picasa.user';
    PicasaUser.base.apply(this, arguments);
    this.files = {};
    this.populated = false;
    this.html = sprintf('<div class="pfolder"><a href="%s" target="_blank">{{name}}</a></div>', this.ident);
};

inherit(PicasaUser, MediaHandler);

PicasaUser.prototype.update = function(meta, opts, cb) {
    var self = this,
        data = meta.raw,
        mtime = moment(data.updated.$t).valueOf(),
        lfile = self._lfile;

    if (self.mtime === mtime) {
        return cb(null, self);
    }

    self.mtime = mtime;
    self.readable = true;
    self.writable = true;
    self.place = data.gphoto$location ? data.gphoto$location.$t: null;
    self.owner = data.gphoto$nickname.$t;
    self.raw = data;
    self.readdir = fstack_passthrough("readdir");
    self.lookup = fstack_passthrough("lookup");
    self.search = fstack_passthrough("search");
    return File.prototype.update.call(self, meta, opts, cb);
};

PicasaFile.prototype.readdir = function(opts, cb) {
    var self = this;

    function makefiles(data) {
        if (data.error) {
            return cb(data.error);
        }
        if (!data.feed) {
            return cb("Invalid JSON");
        }

        var flist = data.feed.entry;
        if (!flist) {
            self.files = {};
            self.populated = true;
            return cb(null, self.files);
        }
        var albums = flist.map(function(item) {
            item['_title'] = item.title.$t;
            return item;
        });
        albums = unique_names(albums, {field: '_title'});

        var files = self.files;
        self.files = {};

        async.forEachSeries(albums, function(al, lcb) {
            var ident = picasa_getlink(al, "self"),
                mime = picasa_getmime(al),
                klass = self.fs.constructor.fileclass,
                file = new klass({ident: ident, name: al.name, fs: self.fs}),
                meta = {raw: al, mime: mime};
        
            file.update(meta, opts, function(err, res) {
                self.files[al.name] = file;
                return lcb(null);
            });
        }, function(err) {
            self.populated = true;
            return cb(null, fstack_topfiles(self.files));
        });
    }

    if (self.populated) { // TODO Check for expires, reload
        return cb(null, fstack_topfiles(self.files));
    }

    self.read({context: opts.context, type: "text"}, ef(cb, function(res) {
        var data = $.parseJSON(res);
        if (!data) {
            return cb('JSON parsing error at ' + self.ident);
        }
        return makefiles(data);
    }));
};

PicasaUser.prototype.bundle = picasa_bundle;

function picasa_bundle(opts, cb) {
    var self = this,
        data = {},
        rsrc = {},
        base = URI.parse(self.redirect_url || self.ident),
        raw = $.extend({}, self.raw);

    var dotmeta = {
        'version': '1.0',
        'origin': self.redirect_url || self.ident
    };

    delete raw.entry;

    var links = [
        {
            "rel": "self",
            "type": "text/html",
            "href": ""
        },
        {
            "rel": "alternate",
            "type": "text/html",
            "href": ""
        }
    ];
    raw.link = links;

    function getthumb(cb) {
        var url, thumb, name;
        if (raw.icon) {
            url = base.resolve(raw.icon.$t);
            name = basename(raw.icon.$t);
        } else if (raw.media$group && raw.media$group.media$thumbnail) {
            thumb = raw.media$group.media$thumbnail[0];
            url = base.resolve(thumb.url);
            name = basename(thumb.url);
        } else {
            return cb(null, null);
        }
        VFS.lookup_uri(url, opts, ef(cb, function(res) {
            rsrc[name] = res;
            if (thumb) {
                thumb.url = ".rsrc/" + name;
                raw.media$group.media$thumbnail = [thumb];
            } else {
                raw.icon.$t = raw.gphoto$thumbnail = ".rsrc/" + name;
            }
            return cb(null, null);
        }));
    }

    function getmedia(cb) {
        var media = raw.media$group.media$content[0],
            url = media.url,
            name = basename(url);

        VFS.lookup_uri(url, opts, ef(cb, function(res) {
            dotmeta.data = {
                'type': 'file',
                'value': name
            };
            data[name] = res;
            media.url = name;
            raw.media$group.media$content = [media];
            return cb(null, null);
        }));
    }

    function do_dump() {
        dotmeta.meta = {
            'mime': self.mime,
            'mtime': self.mtime,
            'raw': raw
        };

        data['.meta'] = JSON.stringify(dotmeta, null, "  ");
        data['.rsrc'] = rsrc;
        return cb(null, data);
    }

    getthumb(function() {
        if (self.mime === 'application/vnd.pigshell.picasa.photo') {
            getmedia(function() {
                return do_dump();
            });
        } else {
            return do_dump();
        }
    });
}

var PicasaAlbum = function(file) {
    this.mime = 'application/vnd.pigshell.picasa.album';
    PicasaAlbum.base.apply(this, arguments);
    this.html = sprintf('<div class="pfolder"><a href="%s" target="_blank">%s</a></div>', file.ident, file.name);
};

inherit(PicasaAlbum, MediaHandler);

PicasaAlbum.prototype.update = function(meta, opts, cb) {
    var self = this,
        data = meta.raw,
        mtime = moment(data.updated.$t).valueOf(),
        u = URI.parse(self.ident),
        lfile = self._lfile;

    if (self.mtime === mtime) {
        return cb(null, self);
    }

    self.ctime = moment(data.published.$t).valueOf();
    self.mtime = mtime;
    self.count = data.gphoto$numphotos.$t;
    self.html = '<div class="pfile picasaPhoto"><a href="' +
        u.resolve(picasa_getlink(data, "alternate")) +
        '" target = "_blank"><img class="image"' +
        ' height="' + data.media$group.media$thumbnail[0].height + 'px"' +
        ' width="' + data.media$group.media$thumbnail[0].width + 'px"' +
        ' src="' + u.resolve(data.media$group.media$thumbnail[0].url) +
        '"></img></a>' +
        '<p class="name">{{name}}</p></div>';
    self.readable = true;
    self.place = data.gphoto$location ? data.gphoto$location.$t: null;
    self.raw = data;
    self.readdir = fstack_passthrough("readdir");
    self.lookup = fstack_passthrough("lookup");
    self.search = fstack_passthrough("search");
    return File.prototype.update.call(self, meta, opts, cb);
};

PicasaAlbum.prototype.bundle = picasa_bundle;

var PicasaPhoto = function(file) {
    this.mime = 'application/vnd.pigshell.picasa.photo';
    PicasaPhoto.base.apply(this, arguments);
    this.html = sprintf('<div class="pfolder"><a href="%s" target="_blank">{{name}}</a></div>', file.ident);
};

inherit(PicasaPhoto, MediaHandler);

PicasaPhoto.prototype.update = function(meta, opts, cb) {
    var self = this,
        data = meta.raw,
        u = URI.parse(self.ident);

    self.ctime = moment(data.published.$t).valueOf();
    self.mtime = moment(data.updated.$t).valueOf();
    self.title = data.title.$t;
    self.thumbnail = {
        url: u.resolve(data.media$group.media$thumbnail[0].url),
        width: data.media$group.media$thumbnail[0].width,
        height: data.media$group.media$thumbnail[0].height
    };
    self.html = '<div class="pfile picasaPhoto"><a href="' +
        picasa_getlink(data, "alternate") +
        '" target="_blank"><img class="image"' +
        ' height="' + self.thumbnail.height + 'px"' +
        ' width="' + self.thumbnail.width + 'px"' +
        ' src=' + self.thumbnail.url + '></img></a>' +
        '<p class="name">{{name}}</p></div>';
        if (data.georss$where !== undefined) {
            var comps = data.georss$where.gml$Point.gml$pos.$t.split(' ');
            self.geo = { type: 'Point', coordinates: [comps[1], comps[0]] };
        }
    self.readable = true;
    self.raw = data;
    return File.prototype.update.call(self, meta, opts, cb);
};

PicasaPhoto.prototype.bundle = picasa_bundle;

function picasa_getlink(raw, rel) {
    var links = raw.link.filter(function(el) {
        return el.rel === rel;
    });
    if (links.length === 0) {
        return null;
    }
    var uri = URI.parse(links[0].href);
    uri.setQuery('');
    return uri.toString();
}

function picasa_getmime(raw) {
    var known = {
            "http://schemas.google.com/photos/2007#album":
                "application/vnd.pigshell.picasa.album",
            "http://schemas.google.com/photos/2007#user":
                "application/vnd.pigshell.picasa.user",
            "http://schemas.google.com/photos/2007#photo":
                "application/vnd.pigshell.picasa.photo"
        };
    return known[raw.category[0].term] || null;
}

VFS.register_handler("picasa", PicasaFS);
VFS.register_handler("PicasaUser", PicasaUser);
VFS.register_handler("PicasaAlbum", PicasaAlbum);
VFS.register_handler("PicasaPhoto", PicasaPhoto);

VFS.register_uri_handler("https://picasaweb.google.com/data/", "picasa", {});
VFS.register_media_handler("application/vnd.pigshell.picasa.user", "PicasaUser", {});
VFS.register_media_handler("application/vnd.pigshell.picasa.album", "PicasaAlbum", {});
VFS.register_media_handler("application/vnd.pigshell.picasa.photo", "PicasaPhoto", {});

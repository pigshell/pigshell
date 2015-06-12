/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * RamFS is a pigshell filesystem which stores data in blobs. Data stored here
 * will disappear on page reload. The root filesystem is a RamFS, populated
 * by untarring a remote root.tar.
 */

var RamFS = function(opts, uri) {
    var self = this,
        Uri = URI.parse(uri);

    RamFS.base.apply(this);
    self.opts = opts;
    self.uri = uri;
    self.Uri = Uri;

    var rootmeta = {
        ident: '/',
        name: '/',
        mtime: Date.now(),
        cookie: Date.now(),
        readable: true,
        writable: true,
        size: 0,
        mime: self.dirmime
    };
    self.rootfile = { meta: rootmeta, data: {} };
};

inherit(RamFS, Filesystem);

RamFS.filesystems = [];

RamFS.prototype.dirmime = 'application/vnd.pigshell.dir+json';
RamFS.prototype.bdlmime = 'application/vnd.pigshell.bundle+json';

RamFS.lookup_uri = HttpFS.lookup_uri;

RamFS.prototype.lookup_rfile = function(path, opts, cb) {
    var self = this,
        comps = path.split('/'),
        curdir = self.rootfile,
        wdcomps = [{name: '/', dir: curdir}];

    for (var i = 0, len = comps.length; i < len; i++) {
        var item = comps[i];
        if (curdir === undefined || curdir.meta.mime !== self.dirmime) {
            return cb(E('ENOENT'));
        }
        if (item === '.' || item === '') {
            continue;
        }
        if (item === '..') {
            if (wdcomps.length > 1) {
                wdcomps.pop();
                curdir = wdcomps[wdcomps.length - 1].dir;
            }
            continue;
        }
        curdir = curdir.data[item];
    }
    if (curdir) {
        return cb(null, curdir);
    } else {
        return cb(E('ENOENT'));
    }
};

RamFS.prototype.rename = function(srcfile, srcdir, sfilename, dstdir,
    dfilename, opts, cb) {
    var self = this,
        sfpath = URI.parse(srcfile.ident).path(),
        sdpath = URI.parse(srcdir.ident).path(),
        dpath = URI.parse(dstdir.ident).path();

    if (dpath.indexOf(sfpath) === 0) {
        /* Parent cannot be moved into child */
        return cb(E('EINVAL'));
    }
    self.lookup_rfile(sdpath, opts, ef(cb, function(rf_srcdir) {
        self.lookup_rfile(dpath, opts, ef(cb, function(rf_dstdir) {
            var f = rf_srcdir.data[sfilename];
            delete rf_srcdir.data[sfilename];
            f.meta.ident = pathjoin(rf_dstdir.meta.ident, encodeURIComponent(dfilename));
            f.meta.name = dfilename;
            if (f.meta.mime === self.dirmime) {
                rename_dir(f);
            }
            rf_dstdir.data[dfilename] = f;
            rf_srcdir.meta.mtime = rf_srcdir.meta.cookie = rf_dstdir.meta.mtime = rf_dstdir.meta.cookie = Date.now();
            fstack_invaldir(srcdir);
            fstack_invaldir(dstdir);
            return cb(null, null);
        }));
    }));

    /* Recursively modify children's ident now that parent has moved */
    function rename_dir(rf) {
        for (var name in rf.data) {
            var f = rf.data[name];
            f.meta.ident = pathjoin(rf.meta.ident, encodeURIComponent(f.meta.name));
            if (f.meta.mime === self.dirmime) {
                rename_dir(f);
            }
        }
    }
};

var RamFile = function() {
    RamFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.ramfile';
    this.html = sprintf('<div class="pfile"><a href="%s" target="_blank">{{name}}</a></div>', this.ident);
};

inherit(RamFile, HttpFile);

RamFS.fileclass = RamFile;

RamFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident);

    self.fs.lookup_rfile(u.path(), opts, ef(cb, function(rfile) {
        var meta = $.extend(true, {}, rfile.meta);
        return cb(null, meta);
    }));
};

RamFile.prototype.getdata = function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident);

    self.fs.lookup_rfile(u.path(), opts, ef(cb, function(rfile) {
        if (rfile.meta.mime !== self.fs.dirmime) {
            if (opts.type === 'text') {
                return to('text', rfile.data, {}, cb);
            } else {
                return cb(null, rfile.data);
            }
        }

        /* Directory case */
        var meta = $.extend(true, {}, rfile.meta),
            data = rfile.data,
            files = [];

        for (var f in data) {
            var file = {};
            // YYY Why only these attributes and not the whole thing?
            mergeattr(file, data[f]["meta"], ["ident", "mtime", "mime", "size",
                "name", "ctime", "readable", "writable"]);
            files.push(file);
        }
        meta.files = files;
        data = JSON.stringify(meta);
        if (opts.type === 'text') {
            return cb(null, data);
        } else {
            var blob = new Blob([data], {type: "application/json"});
            return cb(null, blob);
        }
    }));
};

RamFile.prototype.putdir = mkblob(function(filename, blob, opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        mime = blob.type || 'application/octet-stream',
        efname = encodeURIComponent(filename);

    self.fs.lookup_rfile(u.path(), opts, ef(cb, function(rfile) {
        if (rfile.meta.mime !== self.fs.dirmime) {
            return cb(E('ENOTDIR'));
        }
        var meta = {
                ident: pathjoin(rfile.meta.ident, efname),
                name: filename,
                mtime: Date.now(),
                ctime: Date.now(),
                readable: true,
                writable: true,
                size: blob.size,
                mime: mime || 'application/octet-stream'
            };
        rfile.data[efname] = { meta: meta, data: blob };
        rfile.meta.mtime = rfile.meta.cookie = Date.now();
        return cb(null, null);
    }));
});

RamFile.prototype.append = function(item, opts, cb) {
    var self = this,
        u = URI.parse(self.ident);

    self.fs.lookup_rfile(u.path(), opts, ef(cb, function(rfile) {
        if (rfile.meta.mime === self.fs.dirmime) {
            return cb(E('EISDIR'));
        }
        var blob = new Blob([rfile.data, item], { type: rfile.data.type });
        var isize = isstring(item) ? item.length : item.size;
        rfile.data = blob;
        rfile.meta.size = blob.size;
        rfile.meta.mtime = Date.now();
        return cb(null, null);
    }));
};

RamFile.prototype.rm = function(filename, opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        efname = encodeURIComponent(filename);

    self.fs.lookup_rfile(u.path(), opts, ef(cb, function(rfile) {
        if (rfile.meta.mime !== self.fs.dirmime) {
            return cb(E('ENOTDIR'));
        }
        var file = rfile.data[efname];
        if (file === undefined) {
            return cb(E('ENOENT'));
        }
        if (file.meta.mime === self.fs.dirmime &&
            Object.keys(file.data).length) {
            return cb(E('ENOTEMPTY'));
        }
        delete rfile.data[efname];
        rfile.meta.mtime = rfile.meta.cookie = Date.now();
        return cb(null, null);
    }));
};

RamFile.prototype.mkdir = function(filename, opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        efname = encodeURIComponent(filename);

    self.fs.lookup_rfile(u.path(), opts, ef(cb, function(rfile) {
        if (rfile.meta.mime !== self.fs.dirmime) {
            return cb(E('ENOTDIR'));
        }
        if (rfile.data[filename]) {
            return cb(E('EEXIST'));
        }
        var rmeta = {
                ident: pathjoin(rfile.meta.ident, efname),
                name: filename,
                mtime: Date.now(),
                cookie: Date.now(),
                readable: true,
                writable: true,
                size: 0,
                mime: self.fs.dirmime
            };
            
        rfile.data[efname] = { meta: rmeta, data: {} };
        rfile.meta.mtime = rfile.meta.cookie = Date.now();
        return cb(null, null);
    }));
};

VFS.register_handler("RamFS", RamFS);
VFS.register_uri_handler("ramfs://", "RamFS", {});
URI.register_uri_parser("ramfs", HttpURI);

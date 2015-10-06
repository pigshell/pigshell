/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * This file implements the client side of PstyFS, a simple network filesystem,
 * whose server side is implemented by psty.py. It allows us expose a selected
 * directory on the desktop to be mounted read-write under pigshell.
 *
 */

var PstyFS = function() {
    PstyFS.base.apply(this, arguments);
    this.bdlre = this.opts.bdlmime ? new RegExp("(.*)\\." + this.opts.bdlext + "$", "i") : null;
    this.linkre = this.opts.linkmime ? new RegExp("(.*)\\." + this.opts.linkext + "$", "i") : null;
};

inherit(PstyFS, HttpFS);

PstyFS.lookup_uri = HttpFS.lookup_uri;

PstyFS.defaults = {
    tx: "direct",
    dirmime: "application/vnd.pigshell.dir",
    bdlmime: "application/vnd.pigshell.bundle",
    bdlext: "bdl",
    linkmime: "application/vnd.pigshell.link",
    linkext: "href",
    "application/vnd.pigshell.dir": {
        "cache_time": 5 * 1000 /* 5 seconds */
    }
};

var PstyFile = function() {
    PstyFile.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.pstyfile';
};

inherit(PstyFile, HttpFile);

PstyFS.fileclass = PstyFile;

PstyFS.prototype.rename = function(srcfile, srcdir, sfilename, dstdir,
    dfilename, opts, cb) {
    var self = this,
        form = new FormData(),
        sfile = fstack_base(srcfile),
        spath = URI.parse(sfile.ident).path(),
        dpath = URI.parse(dstdir.ident).path();

    spath = spath.replace(/\/*$/, '');
    dpath = pathjoin(dpath, dfilename);
    if (self.bdlre && spath.match(self.bdlre)) {
        dpath = dpath + "." + self.opts.bdlext;
    } else if (self.linkre && spath.match(self.linkre)) {
        dpath = dpath + "." + self.opts.linkext;
    }
    form.append("op", "rename");
    form.append("src", spath);
    form.append("dst", dpath);

    self.tx.POST(sfile.ident, form, opts, pef(cb, function(res) {
        fstack_invaldir(srcdir);
        fstack_invaldir(dstdir);
        return cb(null, null);
    }));
};

/* Same as the ef error filter, but translates error codes */
function pef(cb, f) {
    return function() {
        if (arguments[0]) {
            var args = [].slice.call(arguments),
                msg = args[0].msg,
                errnames = Object.keys(Errno),
                errid = errnames.indexOf(msg),
                err = {};
            if (errid !== -1) {
                err.code = errnames[errid];
                err.msg = Errno[errnames[errid]];
                args[0] = err;
            }
            return cb.apply(this, args);
        }
        return f.apply(this, [].slice.call(arguments, 1));
    };
}

PstyFile.prototype.getmeta = function(opts, cb) {
    var self = this,
        gopts = $.extend({}, opts, {'params': {'op': 'stat'},
            'responseType': 'text'});

    self.fs.tx.GET(self.ident, gopts, ef(cb, function(res) {
        var headers = header_dict(res),
            mime = xhr_getmime(headers) || '';
        if (!mime.match('vnd.pigshell')) {
            return cb("Expected vnd.pigshell-* mime type at " + self.ident);
        }
        var data = parse_json(res.response);
        if (!data) {
            return cb('JSON parsing error for ' + self.ident);
        }
        return cb(null, self._raw2meta(data));
    }));
};

PstyFile.prototype._raw2meta = function(raw) {
    var self = this;

    if (raw.cookie) {
        raw.etag = raw.cookie;
    }
    cookbdl(self, raw);
    return raw;
};


PstyFile.prototype.read = function(opts, cb) {
    var self = this,
        ropts = opts.read || {},
        umime = self._ufile ? self._ufile.mime : null,
        dir = (umime === self.fs.opts.dirmime);

    if (dir) {
        var etag = ropts.etag,
            gopts = $.extend({}, opts);
        delete gopts["read"];
        //gopts.params = etag ? {etag: etag} : undefined;
        self.fs.tx.GET(self.ident, gopts, ef(cb, function(res) {
            var data = parse_json(res.response);
            if (!data) {
                return cb("JSON parsing error for " + self.ident);
            }
            var files = data.files.map(self._raw2meta.bind(self));
            delete data["files"];
            var dirdata = self._raw2meta(data);
            dirdata.files = files;
            return cb(null, dirdata);
        }));
    } else {
        return PstyFile.base.prototype.read.apply(self, arguments);
    }
};

PstyFile.prototype.putdir = mkblob(function(file, blob, opts, cb) {
    var self = this,
        form = new FormData();

    form.append("op", "put");
    form.append("filename", file);
    form.append("data", blob);

    self.fs.tx.POST(self.ident, form, opts, pef(cb, function(res) {
        return cb(null, null);
    }));
});

PstyFile.prototype.link = function(str, linkname, opts, cb) {
    var self = this;

    if (!self.fs.opts.linkmime) {
        return cb(E("ENOSYS"));
    }
    return self.putdir(linkname + "." + self.fs.opts.linkext, str, opts, cb);
};

PstyFile.prototype.append = function(item, opts, cb) {
    var self = this;

    to('blob', item, {}, ef(cb, function(blob) {
        var form = new FormData();

        form.append("op", "append");
        form.append("data", blob);
        self.fs.tx.POST(self.ident, form, opts,
            pef(cb, function(res) {
            var data = parse_json(res.response);

            if (!data) {
                return cb("JSON parsing error while appending to " + self.ident);
            }
            self.update(data, opts, ef(cb, function(file) {
                return cb(null, null);
            }));
        }));
    }));
};

PstyFile.prototype.rm = function(file, opts, cb) {
    assert("PstyFile.rm.1", file instanceof PstyFile, file);
    var self = this,
        form = new FormData(),
        name = dec_uri(basenamedir(file.ident));

    form.append("op", "rm");
    form.append("filename", name);

    self.fs.tx.POST(self.ident, form, opts, pef(cb, function(res) {
        return cb(null, null);
    }));
};

PstyFile.prototype.mkdir = function(file, opts, cb) {
    var self = this,
        form = new FormData();

    form.append("op", "mkdir");
    form.append("filename", file);

    self.fs.tx.POST(self.ident, form, opts, pef(cb, function(res) {
        return cb(null, null);
    }));
};

VFS.register_handler("PstyFS", PstyFS);
VFS.register_uri_handler("http://localhost:50937", "PstyFS", {});
VFS.register_media_handler("application/vnd.pigshell.link", "HttpLink", {});

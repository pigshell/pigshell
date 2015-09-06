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
};

inherit(PstyFS, HttpFS);

PstyFS.lookup_uri = HttpFS.lookup_uri;

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
        spath = URI.parse(srcfile.ident).path(),
        dpath = URI.parse(dstdir.ident).path();

    spath = spath.replace(/\/*$/, '');
    dpath = pathjoin(dpath, dfilename);
    // XXX Bundle knowledge here isn't nice
    if (spath.match(/\.bdl$/)) {
        dpath = dpath + '.bdl';
    }
    form.append("op", "rename");
    form.append("src", spath);
    form.append("dst", dpath);

    self.tx.POST(srcfile.ident, form, opts, pef(cb, function(res) {
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
        return cb(null, data);
    }));
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

PstyFile.prototype.link = function(file, name, opts, cb) {
    var self = this,
        form = new FormData();

    form.append("op", "link");
    form.append("name", name);
    // YYY Serialize
    form.append("data", '{"ident": "' + file.ident + '"}');

    self.fs.tx.POST(self.ident, form, opts, pef(cb, function(res) {
        return cb(null, null);
    }));
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
    var self = this,
        form = new FormData();

    form.append("op", "rm");
    form.append("filename", file);

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
VFS.register_uri_handler("http://localhost:50937", "PstyFS", {"tx": "direct"});
VFS.register_media_handler("application/vnd.pigshell.link", "HttpLink", {});

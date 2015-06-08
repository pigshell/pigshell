/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * Filesystem to expose the HTML5 upload mechanism. Fairly certain it is broken
 * as I haven't used it in ages.
 */

var UploadFile = function() {
    UploadFile.base.apply(this, arguments);
};

inherit(UploadFile, File);

UploadFile.prototype.readdir = function(opts, cb) {
    var self = this;
    if (self.mime != 'directory') {
        return cb(E('ENOTDIR'));
    }
    return cb(null, self.files);
};

UploadFile.prototype.read = function(opts, cb) {
    var self = this;
    if (self.mime.match("directory")) {
        return cb(E('EISDIR'), self.name);
    }

    function retf(cdata) {
        var data = cloneContent({data: cdata});
        return cb(null, data);
    }
        
    var cdata = cache.get(self.fs.ident + self.ident, self.mtime, true),
        data;

    if (cdata) {
        return retf();
    }
    var fr = new FileReader();
    fr.onload = setcur(function(e) {
        var content = e.target.result;
        if (self.mime.match('image.*')) {
            var img = new Image(),
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');
            img.src = content;
            img.onload = function() {
                canvas.height = img.height;
                canvas.width = img.width;
                ctx.drawImage(img, 0, 0);
                cache.add(self.fs.ident + self.ident, canvas);
                return retf(canvas);
            };
        } else if (self.mime.match('text.*')) {
            cache.add(self.fs.ident + self.ident, content, self.mtime);
            return retf(content);
        } else {
            cdata = new Blob([new DataView(content)], {"type": self.mime});
            cache.add(self.fs.ident + self.ident, cdata, self.mtime);
            return retf(cdata);
        }
    });
    fr.onerror = setcur(function(e) {
        var err = e.target.error;

        if (err.code === err.NOT_FOUND_ERR) {
            return cb(E('ENOENT'));
        } else if (err.code === err.NOT_READABLE_ERR) {
            return cb(E('EPERM'));
        } else {
            return cb(E('EIO'));
        }
    });
    proc.current(null);
    if (self.mime.match('image.*')) {
        fr.readAsDataURL(self.raw);
    } else if (self.mime.match('text.*')) {
        fr.readAsText(self.raw);
    } else {
        fr.readAsArrayBuffer(self.raw);
    }
};

UploadFile.prototype.populate = function(files, cb) {
    var self = this,
        ulist;

    if (self !== self.fs.root) {
        return cb(E('EINVAL'), null);
    }

    self.files = {};
    for (var i = 0, f; (f = files[i]); i++) {
        var newfile = {
            name: f.name,
            ident: f.name,
            pident: uploadfs.root,
            fs: uploadfs.root.fs,
            mime: f.type,
            mtime: moment(f.lastModifiedDate || 0).valueOf(),
            ctime: 0,
            size: f.size,
            readable: true,
            writable: false,
            html: '<div class="pfile">' + f.name + '</div>',
            raw: f
        },
        ufile = new UploadFile(newfile);
        self.files[ufile.name] = ufile;
    }
    return cb(null, null);
};

var UploadFS = function() {
    var self = this,
        rootfile = {
            name: '/',
            ident: '/',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            mime: 'directory',
            htmlClass: 'pfolder',
            files: {},
            populated: true
        };
    UploadFS.base.call(self);
    self.ident = 'uploads';
    self.root = new UploadFile(rootfile);
    self.root.files = {};
};

inherit(UploadFS, Filesystem);

VFS.register_handler("UploadFS", UploadFS);

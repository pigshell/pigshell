/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var LstorFile = function() {
    LstorFile.base.apply(this, arguments);
};

inherit(LstorFile, File);

LstorFile.prototype._readdir = function(opts, cb) {
    var self = this,
        lstor = self.fs.lstor;
    if (self.ident !== 'lstor:/') {
        return cb(E('ENOTDIR'));
    }
    self.files = {};
    for (var i = 0; i < lstor.length; i++) {
        var key = lstor.key(i);
        if (!key) {
            continue;
        }
        var name = key.replace(/\//g, '_'),
            newfile = {
                name: name,
                key: key,
                ident: pathjoin(self.ident, name),
                readable: true,
                writable: true,
                fs: self.fs,
                html: '<div class="pfile">' + name + '</div>',
                size: 0
            };
        if (isstring(lstor[key])) {
            newfile.mime = 'text/plain';
            newfile.size = lstor[key].length;
        } else {
            newfile.mime = 'application/octet-stream';
        }

        var newf = new LstorFile(newfile);
        self.files[name] = newf;
    } 
    return cb(null, self.files);
};


LstorFile.prototype.read = function(opts, cb) {
    var self = this,
        lstor = self.fs.lstor;

    if (self.mime.match("directory")) {
        return cb(E('EISDIR'), self.name);
    } else {
        return cb(null, lstor[self.key]); // TODO: clone?
    }
};

LstorFile.prototype.append = function(item, opts, cb) {
    var self = this,
        lstor = self.fs.lstor;

    if (self.mime !== 'text/plain') {
        return cb(E('EINVALFILE'), null);
    }
    if (!isstring(item)) {
        return cb(E('EINVAL'), null);
    }
    lstor.setItem(self.key, lstor[self.key] + item); // TODO: try/catch
    return cb(null, null);
};


LstorFile.prototype.putdir = function(name, dlist, opts, cb) {
    var self = this,
        lstor = self.fs.lstor,
        str;

    if (self.ident !== 'lstor:/') {
        return cb(E('ENOTDIR'));
    }
    if (dlist.length === 0) {
        return cb(null, null);
    }
    if (isstring(dlist[0])) {
        str = dlist.join('');
    } else {
        return cb(E('EINVAL'), null);
    }

    lstor.setItem(name, str); // TODO: try/catch
    return cb(null, null);
};

LstorFile.prototype.rm = function(name, opts, cb) {
    var self = this,
        lstor = self.fs.lstor;

    if (self.ident !== 'lstor:/') {
        return cb(E('ENOTDIR'));
    }
    lstor.removeItem(name);
    return cb(null, null);
};

var LstorFS = function(obj, opts) {
    LstorFS.base.call(this);
    this.lstor = window.localStorage; // Object we are shadowing
    this.opts = $.extend({}, opts);
    var rootfile = {
        name: '/',
        ident: 'lstor:/',
        readable: true,
        writable: true,
        fs: this,
        mime: 'directory',
        mtime: 0,
        htmlClass: 'pfolder',
        files: {},
        populated: false
    };
    this.root = new LstorFile(rootfile);
    this.root.readdir = this.root._readdir;
};

inherit(LstorFS, Filesystem);

VFS.register_handler("LstorFS", LstorFS);

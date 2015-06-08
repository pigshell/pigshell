/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var DevFile = function() {
    DevFile.base.apply(this, arguments);
};

inherit(DevFile, File);

var NullFile = function() {
    NullFile.base.apply(this, arguments);
};

inherit(NullFile, File);

NullFile.prototype.read = function(opts, cb) {
    return cb(null, '');
};

NullFile.prototype.append = function(item, opts, cb) {
    return cb(null);
};

DevFile.prototype.putdir = function(file, clist, opts, cb) {
    return cb(null, null);
};

DevFile.prototype.readdir = function(opts, cb) {
    this.populated = true;
    return cb(null, this.files);
};

var DevFS = function() {
    var self = this,
        nullfile = {
            name: 'null',
            ident: 'null',
            readable: true,
            writable: true,
            fs: self,
            owner: 'me',
            mime: 'device',
            html: '<div class="pfile">null</div>'
        },
        rootfile = {
            name: 'dev',
            ident: 'dev',
            readable: true,
            writable: true,
            fs: self,
            mime: 'directory',
            htmlClass: 'pfolder',
            files: {}
        };
    DevFS.base.call(self);
    self.root = new DevFile(rootfile);

    var nfile = new NullFile(nullfile);
    self.root.files = {'null': nfile};
    self.root.populated = true;
};

inherit(DevFS, Filesystem);

VFS.register_handler("DevFS", DevFS);

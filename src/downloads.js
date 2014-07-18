/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var DownloadFile = function() {
    DownloadFile.base.apply(this, arguments);
};

inherit(DownloadFile, File);

DownloadFile.prototype.read = function(opts, cb) {
    var self = this;
    return cb(E('EACCES'), self.name);
};

DownloadFile.prototype.putdir = mkblob(function(file, blob, opts, cb) {
    saveAs(blob, file);
    return cb(null, null);
});

var DownloadFS = function() {
    var self = this,
        rootfile = {
            name: '/',
            ident: '/',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            mime: 'directory',
            htmlClass: 'nativeFolder',
            files: {},
            populated: true
        };
    DownloadFS.base.call(self);
    self.ident = 'download';
    self.root = new DownloadFile(rootfile);
};

inherit(DownloadFS, Filesystem);

DownloadFS.fsname = "DownloadFS";
DownloadFS.fileclass = DownloadFile;

/* OBSOLETE DOES NOT WORK */
goog.require('file');
goog.provide('plus');

var PlusFile = function() {
    PlusFile.base.apply(this, arguments);
}

inherit(PlusFile, File);

PlusFile.prototype.getfile = function(file) {
    var self = this;
    var newfile = {
        name: file.name,
        ident: file.id,
        pident: self.ident,
        readable: true,
        writable: false,
        mime: 'text/json',
        fs: self.fs,
        mime: (file.mimeType === 'application/vnd.google-apps.folder') ? 'directory' : file.mimeType,
        ctime: moment(file.published).valueOf(),
        mtime: moment(file.updated).valueOf(),
        owner: file.actor.displayName,
        populated: false,
        files: {},
        title: file.title,
        size: file.fileSize || 0,
        html: '<div class="plFile">' + file.name + '</div>',
        raw: file,
        content: file.content 
    };
    return new PlusFile(newfile);
}

PlusFile.prototype.readdir = function(opts, cb) {
    var self = this;
    if (self.mime != 'directory') {
        return cb(E('ENOTDIR'));
    }
    if (self.populated) {
        return cb(null, self.files);
    }
    
    gapi.client.request({
        path: '/plus/v1/people/me/activities/public?alt=json',
        callback: function(myfiles) {
            if (!myfiles) {
                return cb('Plus API returned null');
            }
            if (myfiles.error) {
                return cb(myfiles.error);
            }

            var files = unique_names(myfiles.items);

            var newf = [];
            var id_title = {};

            for (var i = 0, j = files.length; i < j; i++) {
                self.files[file.name] = self.getfile(file);
            }
            self.populated = true;
            return cb(null, self.files);
        }
    });
}

PlusFile.prototype.read = function(opts, cb) {
    return cb(null, this);
}

var PlusFS = function() {
    var self = this,
    rootfile = {
    name: '/',
    ident: '/',
    pident: '/',
    readable: true,
    writable: true,
    fs: self,
    mime: 'directory',
    htmlClass: 'plFolder',
    files: {},
    populated: false
    };
    PlusFS.base.call(self);
    self.root = new PlusFile(rootfile);
}

inherit(PlusFS, Filesystem);

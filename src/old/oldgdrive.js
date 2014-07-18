/* Copyright (C) 2012 by Coriolis Technologies Pvt Ltd. All rights reserved. */
goog.require('file');
goog.provide('gdrive');

var GDriveFile = function() {
    GDriveFile.base.apply(this, arguments);
};

inherit(GDriveFile, File);

GDriveFile.prototype.clearfolder = function() {
    var self = this;
    delete self.files;
    self.files = {};
    self.populated = false;
};

GDriveFile.prototype.getDownloadUrl = function(file) {
    var linkType = null;
    if (file.mimeType.search('google-apps') >= 0) {
        for (var type in file.exportLinks) {
            if (type.search('officedocument') >= 0) {
                linkType = type;
            }
        }
    }
    return file.downloadUrl || 
        (linkType !== null ? file.exportLinks[linkType]:
            (file.exportLinks ?
                (file.exportLinks['text/html'] ?
                    file.exportLinks['text/html'] :
                    file.exportLinks['application/pdf']) :
                null));
};

GDriveFile.prototype.getfile = function(file) {
    var self = this;
    var newfile = {
        name: file.name,
        ident: file.id,
        pident: self.ident,
        parents: file.parents,
        readable: true,
        writable: file.editable,
        fs: self.fs,
        mime: (file.mimeType === 'application/vnd.google-apps.folder') ? 'directory' : file.mimeType,
        ctime: moment(file.createdDate).valueOf(),
        mtime: moment(file.modifiedDate).valueOf(),
        owner: file.ownerNames[0],
        populated: false,
        files: {},
        title: file.title,
        size: file.fileSize || 0,
        html: '<div class=' + (file.mimeType === 'application/vnd.google-apps.folder' ? '"gdFolder"' : '"gdFile"') + '><a target="_blank" href="' + file.alternateLink + '">' + file.name + '</a></div>',
        raw: file,
        data: {url: self.getDownloadUrl(file)},
        // content: 'https://drive.google.com/uc?export=&confirm=no_antivirus&id=' + file.id,
        homeUrl: file.alternateLink

    };
    if (file.thumbnailLink) {
        newfile.thumbnail = {url: file.thumbnailLink};
    }
    
    return new GDriveFile(newfile);
};

GDriveFile.prototype.readdir = function(opts, cb) {
    var self = this,
        options = $.extend({'reload': false}, opts),
        reload = options['reload'];
    if (self.mime != 'directory') {
        return cb(E('ENOTDIR'));
    }
    if (self.populated && !reload) {
        return cb(null, self.files);
    }

    if (reload) {
        self.clearfolder();
    }

    
    gapi.client.request({
        path: '/drive/v2/files',
        callback: function(myfiles) {
            if (!myfiles) {
                return cb('GD API returned null');
            }
            if (myfiles.error) {
                return cb(myfiles.error);
            }

            var files = unique_names(myfiles.items);

            var newf = [];
            var id_title = {};

            for (var i = 0, j = files.length; i < j; i++) {
                var file = files[i];
                // suboptimal fetch, only uses files that are direct children
                // other files have to be fetched again
                if (!file.labels.trashed) {
                    if (self.ident === '/' &&
                        (file.parents.length === 0 || file.parents[0]['isRoot'])) {
                        self.files[file.name] = self.getfile(file);
                    }
                    var parents = file.parents.map(function(p) { return p.id; });
                    if ($.inArray(self.ident, parents) !== -1) {
                        self.files[file.name] = self.getfile(file);
                    }
                }
            }
            self.populated = true;
            return cb(null, self.files);
        }
    });
};

GDriveFile.prototype.mkdir = function(name, opts, cb) {
    var self = this;
    var folder = {};
    folder.title = name;
    folder.mimeType = 'application/vnd.google-apps.folder';
    if (self.ident !== '/') {
        folder.parents = [self.ident];
    }
    gapi.client.request({
        path: '/drive/v2/files',
        method: 'POST',
        body: JSON.stringify(folder),
        callback: function(file) {
            if (!file) {
                return cb('GD API returned null');
            }
            if (file.error) {
                return cb(file.error);
            }
            self.clearfolder();
            return cb(null, file);
        }
    });
};

GDriveFile.prototype.rm = function(name, opts, cb) {
    var self = this;
    var rmf = self.files[name];
    if(rmf) {
        gapi.client.request({
            path: '/drive/v2/files/' + rmf.ident + '/trash',
            method: 'POST',
            callback: function(response) {
                if (!response) {
                    return cb('GD API returned null');
                }
                if (response.error) {
                    return cb(response.error);
                }
                self.clearfolder();
                return cb(null, response);
            }
        });
    } else {
        return cb(E('ENOENT'));
    }
};

/* clist is an array of objects that can be canvas, string or blob
 * for now there is a list, it should be a single object
 */
GDriveFile.prototype.putdir = function(file, clist, opts, cb) {
    var self = this,
        content;

    if (isstring(clist[0])) { // treat the whole array as a single text file
        content = clist.join('');
    } else { // process only first element of array
        content = clist[0];
    }
    if (content === undefined) {
        return cb('no content?', null);
    }
    var jsonfile = {};
    jsonfile.title = file;
    if (self.ident !== '/') {
        jsonfile.parents = [self.ident];
    }
    var boundary = '-------314159265358979323846';
    var delimiter = "\r\n--" + boundary + "\r\n";
    var close_delim = "\r\n--" + boundary + "--";
    var contentType = getMimeFromExtension(file) || 'application/octect-stream';
    if (isstring(content)) {
        contentType = "text/plain";
        upload();
    } else if (content.constructor === HTMLCanvasElement) {
        if (contentType !== 'image/jpeg') {
            contentType = 'image/png';
        }
        content = content.toDataURL(contentType);
        content = content.replace(/^data:image\/(png|jpeg);base64,/, "");
        upload();
    } else { // blob
        var fileReader = new FileReader();
        fileReader.onload = upload;
        fileReader.readAsDataURL(content);
    }

    function upload(e) {
        if (e !== undefined) {
            content = e.target.result.replace(/^data:undefined;base64,/, "");
        }
        var metadata = {
            'title': file,
            'mimeType': contentType
        };
        var multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n' +
            (contentType.match(/^image|^application/) ? 'Content-Transfer-Encoding: base64\r\n' : '') +
            '\r\n' +
            content +
            close_delim;
        
        gapi.client.request({
            'path': '/upload/drive/v2/files',
            'method': 'POST',
            'params': {'uploadType': 'multipart'},
            'headers': {
                'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody,
            callback: function(file) {
                if (!file) {
                    return cb('GD API returned null');
                }
                if (file.error) {
                    return cb(file.error);
                }
                self.clearfolder();
                return cb(null, file);
            }
        });
    }
};

GDriveFile.prototype.read = function(opts, cb) {
    var self = this,
        cdata = cache.get(self.fs.ident + self.ident, self.mtime, true),
        data;
    if (cdata) {
        data = cloneContent(cdata);
        return cb(null, data);
    }
    if (self.mime.match("directory")) {
        return cb(E('EISDIR'), null);
    } else if (self.mime.match(/^image/)) {
       var img = new Image(),
           canvas = document.createElement('canvas'),
           ctx = canvas.getContext('2d');

        img.crossOrigin = "Anonymous";
        img.src = self.data.url + "&access_token=" + 
            gapi.auth.getToken().access_token;
        img.onload = function() {
            canvas.height = img.height;
            canvas.width = img.width;
            ctx.drawImage(img, 0, 0);
            cache.add(self.fs.ident + self.ident, canvas, self.mtime);
            data = cloneCanvas(canvas);
            return cb(null, data);
        };
    } else {
        $.ajax({
            type: 'GET',
            beforeSend: function(xhr) {
                xhr.overrideMimeType('text/plain; charset=x-user-defined');
            },
            url: self.data.url + "&access_token=" + 
                gapi.auth.getToken().access_token
            })
        .done(function(data, textStatus, jqXHR) {
            if (self.mime.match(/^text/)) {
                cache.add(self.fs.ident + self.ident, data, self.mtime);
                return cb(null, data);
            } else {
                var byteArray = new Uint8Array(data.length);
                for (var i = 0; i < data.length; i++) {
                    byteArray[i] = data.charCodeAt(i) & 0xff;
                }
                var blob = new Blob([byteArray], {"type": self.mime});
                cache.add(self.fs.ident + self.ident, blob, self.mtime);
                return cb(null, cloneContent(blob));
            }
        })
        .fail(function(data, textStatus, jqXHR) {
            return cb(textStatus, null);
        });
    }
};

var GDriveFS = function(myname) {
    var self = this,
    rootfile = {
        name: '/',
        ident: '/',
        pident: '/',
        readable: true,
        writable: true,
        fs: self,
        mime: 'directory',
        htmlClass: 'gdFolder',
        files: {},
        populated: false,
        owner: myname
    };
    GDriveFS.base.call(self);
    self.root = new GDriveFile(rootfile);
};

inherit(GDriveFS, Filesystem);

GDriveFS.fsname = "GDriveFS";

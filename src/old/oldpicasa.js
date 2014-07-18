/* Copyright (C) 2012 by Coriolis Technologies Pvt Ltd. All rights reserved. */
goog.require('file');
goog.provide('picasa');

var OldPicasaFile = function() {
    OldPicasaFile.base.apply(this, arguments);
};

inherit(OldPicasaFile, File);

OldPicasaFile.prototype.getAlbumLink = function(album) {
    return album.link.filter(function(element, index, array) {
        return element.type === 'text/html';
    })[0].href;
};

OldPicasaFile.prototype.getPhotoLink = function(photo) {
    return photo.link.filter(function(element, index, array) {
        return (element.type === 'text/html' && element.rel === 'alternate');
    })[0].href;
};

OldPicasaFile.prototype.albumdir_readdir = function(opts, cb) {
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
        delete self.files;
        self.files = {};
        self.populated = false;
    }

    $.getJSON('https://picasaweb.google.com/data/feed/api/user/default?alt=json&kind=album&thumbsize=72u&access_token=' + self.fs.authToken, function(myalbums) {
        if (!myalbums) {
            return cb('OldPicasa API returned null');
        }
        if (myalbums.error) {
            return cb(myalbums.error);
        }

        if (myalbums.feed.entry !== undefined) {
            var albums = myalbums.feed.entry.map(function(item) {
                item['_title'] = item.title.$t;
                return item;
            });
            albums = unique_names(albums, {field: '_title'});
            for (var i = 0, j = albums.length; i < j; i++) {
                var album = albums[i];
                var newfile = {
                    name: album.name,
                    ident: album.gphoto$id.$t,
                    pident: self.ident,
                    readable: true,
                    writable: false,
                    mime: 'directory',
                    fs: self.fs,
                    ctime: moment(album.published.$t).valueOf(),
                    mtime: moment(album.updated.$t).valueOf(),
                    files: {},
                    count: album.gphoto$numphotos.$t,
                    title: album.title.$t,
                    html: '<div class="picasaPhoto"><a href="' +
                        self.getAlbumLink(album) +
                        '" target = "_blank"><img class="image"' +
                        ' height="' + album.media$group.media$thumbnail[0].height + 'px"' +
                        ' width="' + album.media$group.media$thumbnail[0].width + 'px"' +
                        ' src=' + album.media$group.media$thumbnail[0].url + '></img></a>' +
                        '<p class="name">' + album.name + '</p></div>',
                    raw: album,
                    thumbnail: {
                        url: album.media$group.media$thumbnail[0].url,
                        height: album.media$group.media$thumbnail[0].height,
                        width: album.media$group.media$thumbnail[0].width
                    },
                    homeUrl: self.getAlbumLink(album)
                };
                newfile.place = album.gphoto$location ? album.gphoto$location.$t: null;
                var newf = new OldPicasaFile(newfile);
                newf.readdir = newf.album_readdir;
                self.files[newfile.name] = newf;
            }
        }
        self.populated = true;
        return cb(null, self.files);
    });
};

OldPicasaFile.prototype.album_readdir = function(opts, cb) {
    var self = this,
        options = $.extend({'reload': false}, opts),
        reload = options['reload'];
    if (self.mime != 'directory') {
        return cb(E('ENOTDIR'));
    }
    if (self.populated & !reload) {
        return cb(null, self.files);
    }

    if (reload) {
        delete self.files;
        self.files = {};
        self.populated = false;
    }

    $.getJSON("https://picasaweb.google.com/data/feed/base/user/default/albumid/" + self.ident +"?alt=json&kind=photo&imgmax=d&access_token=" + self.fs.authToken, function(myphotos) {
        if (!myphotos) {
            return cb('OldPicasa API returned null');
        }
        if (myphotos.error) {
            return cb(myphotos.error);
        }

        if (myphotos.feed.entry !== undefined) {
            var photos = myphotos.feed.entry.map(function(item) {
                item['_title'] = item.title.$t;
                return item;
            });
            photos = unique_names(photos, {field: '_title'});
            for (var i = 0, j = photos.length; i < j; i++) {
                var photo = photos[i];
                var newfile = {
                    name: photo.name,
                    ident: photo.id.$t.split('/')[11].split('?')[0],
                    pident: self.ident,
                    readable: true,
                    writable: true,
                    mime: 'image/unknown',
                    fs: self.fs,
                    ctime: moment(photo.published.$t).valueOf(),
                    mtime: moment(photo.updated.$t).valueOf(),
                    place: '',
                    data: {url: photo.content.src},
                    title: photo.title.$t,
                    html: '<div class="picasaPhoto"><a href="' +
                    self.getPhotoLink(photo) + '" target="_blank"><img class="image"' +
                    ' height="' + photo.media$group.media$thumbnail[0].height + 'px"' +
                    ' width="' + photo.media$group.media$thumbnail[0].width + 'px"' +
                    ' src=' + photo.media$group.media$thumbnail[0].url + '></img></a>' +
                    '<p class="name">' + photo.name + '</p></div>',
                    raw: photo,
                    thumbnail: {
                        url: photo.media$group.media$thumbnail[0].url,
                        height: photo.media$group.media$thumbnail[0].height,
                        width: photo.media$group.media$thumbnail[0].width
                    },
                    homeUrl: self.getPhotoLink(photo)
                };
                var urlcomps = newfile.thumbnail.url.split('/');
                urlcomps[urlcomps.length - 2] = 's912';
                newfile.content = urlcomps.join('/');
                if(typeof photo.georss$where !== 'undefined') {
                    newfile.coords = {lat:photo.georss$where.gml$Point.gml$pos.$t.split(' ')[0], lon:photo.georss$where.gml$Point.gml$pos.$t.split(' ')[1]};
                }
                var newf = new OldPicasaFile(newfile);
                newf.read = self.photo_read;
                self.files[newfile.name] = newf;
            }
        }
        self.populated = true;
        return cb(null, self.files);
    });
};
/*
OldPicasaFile.prototype.albumdir_mkdir = function(name, cb) {
    var self = this;
    $.ajax({
        type: 'POST',
        url: [  'https://picasaweb.google.com/data/feed/api/user/default?',
                'kind=album&alt=json&access=all&access_token=',
                self.fs.authToken
            ].join(''),
        headers: {
            'GData-Version': '2',
            'Content-Type': 'application/atom+xml'
        },
        data: [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<entry xmlns='http://www.w3.org/2005/Atom'",
            "xmlns:media='http://search.yahoo.com/mrss/'",
            "xmlns:gphoto='http://schemas.google.com/photos/2007'>",
            "<title type='text'>",name,"</title>",
            "<summary type='text'>",name,"</summary>",
            "<gphoto:access>protected</gphoto:access>",
            "<gphoto:timestamp>",Date.now(),"</gphoto:timestamp>",
            "<category scheme='http://schemas.google.com/g/2005#kind' ",
            "term='http://schemas.google.com/photos/2007#album'></category>",
            "</entry>"
            ].join(""),
        dataType: 'json',
        processData: false
        }).done(
        function(data, textStatus, jqXHR) {
            // reset this folder to fetch data again
            delete self.files;
            self.files = {};
            self.populated = false;

            return cb(null, myalbum);
        }
        ).fail(
        function(data, textStatus, jqXHR) {
            return cb(textStatus, null);
        }
        );
}
*/
OldPicasaFile.prototype.photo_read = function(opts, cb) {
    var self = this,
        cdata = cache.get(self.fs.ident + self.ident, self.mtime, true),
        data;

    if (cdata) {
        data = cloneCanvas(cdata);
        return cb(null, data);
    }

   var img = new Image(),
       canvas = document.createElement('canvas'),
       ctx = canvas.getContext('2d');

    img.crossOrigin = "Anonymous";
    img.src = self.data.url;
    img.onload = function() {
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0);
        cache.add(self.fs.ident + self.ident, canvas, self.mtime);
        data = cloneCanvas(canvas);
        return cb(null, data);
    };
};

var OldPicasaFS = function(authToken, myname) {
    var self = this,
        rootfile = {
            name: '/',
            ident: '/',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            mime: 'directory',
            htmlClass: 'picasaFolder',
            files: {},
            populated: true,
            owner: myname
        },
        albumdir = {
            name: 'albums',
            ident: 'me',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            mime: 'directory',
            html: '<div class="picasaFolder">albums</div>',
            files: {},
            populated: false,
            owner: myname
        };
    OldPicasaFS.base.call(self);
    self.ident = 'picasa';
    self.authToken = authToken;
    self.root = new OldPicasaFile(rootfile);
    var ald = new OldPicasaFile(albumdir);
    ald.readdir = ald.albumdir_readdir;
//    ald.mkdir = ald.albumdir_mkdir;
    self.root.files = {'albums': ald};
};

inherit(OldPicasaFS, Filesystem);

OldPicasaFS.fsname = "OldPicasaFS";

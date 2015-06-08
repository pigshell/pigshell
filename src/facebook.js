/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var FacebookFile = function() {
    FacebookFile.base.apply(this, arguments);
    this.lastReadDir = new Date().getTime();
    this.newest = 0;
    this.limit = 20;
    this.oldest = Number.MAX_VALUE;
};

inherit(FacebookFile, File);

FacebookFile.prototype.err = function(error) {
    if (error && error.message) {
        return {code:'EFB', msg: sprintf('%s (code: %s, subcode: %s, type: %s)',
            error.message, error.code || 'unknown',
            error.error_subcode || 'unknown',
            error.type || 'unknown')};
    } else {
        return {code: 'EFB', msg: 'FB API returned null'};
    }
};

FacebookFile.prototype.create_photo_html = function(photo) {
    var html = '<div class="fbPhoto"><a href="' + photo.link +
        '" target = "_blank"><img class="image" ' +
        'height="' + photo.images[photo.images.length-1].height + 'px"' +
        'width="' + photo.images[photo.images.length-1].width + 'px"' +
        ' src=' + photo.picture + '></img></a>' +
        '<p class="name">' + photo.name + '</p>';
/*  Disable social for now
    var social = [];
    if (photo.likes) {
        social.push('<div class="likes">Likes '
            + photo.likes.data.length + '</div>');
    }
    if (photo.shares) {
        social.push('<div class="shares">Shares '
            + photo.shares.data.length + '</div>');
    }
    if (photo.comments) {
        social.push('<div class="comments">Comments '
            + photo.comments.data.length + '</div>');
    }
    social.push('<div class="time">' + fb_time(photo.created_time) + '</div>');
    html += social.join(' ');
    if (photo.comments && photo.comments.data) {
        for (var i = 0; i < photo.comments.data.length; i++) {
            var comment = photo.comments.data[i];
            html += '<div class="comment">'
                + '<div class="from">' + comment.from.name + '</div> '
                + '<div class="time">' + fb_time(comment.created_time) + '</div>'
                + '<div class="message">' + fb_urlize(comment.message) + '</div>';
            html += '</div>';
        }
    }
*/
    return html + '</div>';
};

FacebookFile.prototype.create_post_html = function(post) {
    var self = this;
    var html = '';
    var from = '<div class="fbPost"><div class="from">' +
        post.from.name + '</div>';
    var text = [];
    if (post.story) {
        text.push('<div class="text">' + fb_tag_story(post) + '</div>');
    }
    if (post.name && post.type !== "link") {
        text.push('<div class="text">' + fb_urlize(post.name) + '</div>');
    }
    if (post.message) {
        text.push('<div class="text">' + fb_urlize(post.message) + '</div>');
    }
    if (post.place) {
        text.push('<div class="text">@<a target="_blank" href="https://facebook.com/' + post.place.id + '">' + post.place.name + '</a></div>');
    }
    if (post.description) {
        text.push('<div class="text">' + fb_urlize(post.description) + '</div>');
    }
    html += text.join('');
    switch(post.type) {
        case "link":
            html += '<div class="link"><a target="_blank" href="' +
                post.link + '">' + (post.name === undefined ?
                    post.link : post.name) + 
                '</a></div>';
            break;
        case "photo":
            html += '<div class="photo"><a target="_blank" href="' +
                post.picture.replace("_s.", "_n.") +
                '"><img src="' + post.picture + '"></img></a></div>';
            break;
        case "video":
            html += '<div class="video"><a target="_blank" href="' +
                post.link + '"><img src="' + post.picture + '"></img></a></div>';
            break;
        case "status":
            if (post.status_type === "wall_post" && post.to !== undefined) {
                from = '<div class="fbPost"><div class="from">'+
                    post.from.name + ' -> ' + post.to.data[0].name +'</div>';
            }
            break;
        case "checkin":
            break;
        case "offer":
            break;
        default:
    }
    html = from + html;
    if (post.caption !== undefined) {
        html += '<div class="caption">' + fb_urlize(post.caption) + '</div>';
    }
    var social = [];
    if (post.likes && post.likes.count > 0) {
        social.push('<div class="likes">Likes ' + post.likes.count + '</div>');
    }
    if (post.shares && post.shares.count > 0) {
        social.push('<div class="shares">Shares ' + post.shares.count + '</div>');
    }
    if (post.comments && post.comments.count > 0) {
        social.push('<div class="comments">Comments ' + post.comments.count + '</div>');
    }
    if (post.actions && post.actions.length > 0 && post.actions[0].link) {
        social.push('<div class="time"><a href="' + post.actions[0].link +
            '" target="_blank">' + fb_time(post.created_time) + '</a></div>');
    } else {
        social.push('<div class="time">' + fb_time(post.created_time) + '</div>');
    }

    html += social.join(' ');
    if (post.comments && post.comments.data) {
        for (var i = 0; i < post.comments.data.length; i++) {
            var comment = post.comments.data[i];
            html += '<div class="comment">' +
                '<div class="from">' + comment.from.name + '</div> ' +
                '<div class="time">' + fb_time(comment.created_time) + '</div>' +
                '<div class="message">' + fb_urlize(comment.message) + '</div>';
            if (comment.likes > 0) {
                html += '<div class="likes">Likes ' + comment.likes + '</div>';
            }
            html += '</div>';
        }
    }
    return html + '</div>';
};

FacebookFile.prototype.albumdir_readdir = function(opts, cb) {
    var self = this,
        options = $.extend({'reload': false}, opts),
        reload = options['reload'];
    if (self.mime !== 'directory') {
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

    FB.api('/' + self.pident + '/albums', function(myalbums) {
        if (!myalbums) {
            return cb(self.err());
        }
        if (myalbums.error) {
            return cb(self.err(myalbums.error));
        }

        var albums = myalbums.data.map(function(item) {
            item['title'] = item['name'];
            return item;
        });
        albums = unique_names(albums, {});
        for (var i = 0, j = albums.length; i < j; i++) {
            var album = albums[i];
            var newfile = {
                name: album.name,
                ident: album.id.toString(),
                pident: self.ident,
                readable: true,
                writable: (album.can_upload) ? true : false,
                mime: 'directory',
                fs: self.fs,
                owner: self.owner,
                ctime: moment(album.created_time).valueOf(),
                mtime: moment(album.updated_time).valueOf(),
                place: album.place,
                files: {},
                count: album.count,
                title: album.title,
                html: '<div class="fbAlbum">' + album.name + '</div>',
                likes: album.likes ? album.likes.data.length : 0,
                shares: album.shares ? album.shares.data.length : 0,
                comments: album.comments ? album.comments.data.length : 0,
                raw: album,
                homeUrl: album.link
            };
            if (typeof album.place !== 'undefined') {
                newfile.geo = {
                    type: 'Point',
                    coordinates: [album.place.location.longitude, album.place.location.latitude]
                };
            }
            var newf = new FacebookFile(newfile);
            newf.readdir = newf.album_readdir;
            newf.putdir = newf.album_putdir;
            self.files[album.name] = newf;
        } 
        self.populated = true;
        return cb(null, self.files);
    });
};

FacebookFile.prototype.getuser = function(friend, createSub) {
    var self = this;
    if (createSub === undefined) {
        createSub = true;
    }
    var newfile = {
        name: friend.name,
        ident: friend.uid.toString(),
        pident: self.ident,
        readable: true,
        mime: 'directory',
        fs: self.fs,
        files: {},
        title: friend.title,
        owner: friend.name,
        html: '<div class="fbFriend"><a href="' + friend.profile_url +
            '" target="_blank"><img class="image" height="50" width="50" src=' +
            friend.pic_square + '></img></a><p class="name">' +
            friend.name + '</p></div>',
        populated: true,
        relationship_status: friend.relationship_status,
        gender: friend.sex,
        friend_count: friend.friend_count,
        mutual_friend_count: friend.mutual_friend_count,
        raw: friend,
        thumbnail: {
            url: friend.pic_square,
            height: 50,
            width: 50
        },
        homeUrl: friend.profile_url
    };
    if (friend.birthday_date === null) {
        newfile.birthday = null;
    } else {
        var dcomps = friend.birthday_date.split('/');
        if (dcomps.length === 2) {
            dcomps.push('2222');
        }
        newfile.birthday = moment(dcomps.join('/'), 'MM/DD/YYYY');
    }
    var fl = friend.current_location || friend.hometown_location;
    if (fl !== null && fl.latitude !== undefined &&
        fl.longitude !== undefined) {
        newfile.geo = {
            type: 'Point',
            coordinates: [fl.longitude, fl.latitude]
        };
    }
    var nf = new FacebookFile(newfile);
    if (createSub) {
        var walldir = {
            name: 'wall',
            ident: 'wall',
            pident: friend.uid,
            readable: true,
            writable: friend.can_post,
            feed: true,
            fs: self.fs,
            owner: friend.name,
            mime: 'directory',
            html: '<div class="fbFolder">wall</div>',
            files: {},
            populated: false
        };
        var albumdir = {
            name: 'albums',
            ident: 'albums',
            pident: friend.uid,
            readable: true,
            writable: false,
            owner: friend.name,
            fs: self,
            mime: 'directory',
            html: '<div class="fbFolder">albums</div>',
            files: {},
            populated: false
        };
        var ald = new FacebookFile(albumdir);
        ald.readdir = ald.albumdir_readdir;
        ald.mkdir = ald.albumdir_mkdir;
        var wad = new FacebookFile(walldir);
        wad.readdir = wad.wall_readdir;
        wad.putdir = wad.feed_putdir;
        nf.files = {'albums':ald, 'wall': wad};
    }
    return nf;
};

FacebookFile.prototype.getMyData = function(cb) {
    var self = this;

    var queries = {
        me: 'select name,pic_square,profile_url,about_me,uid,birthday,' +
            'birthday_date,hometown_location,relationship_status,' +
            'significant_other_id,' +
            'sex,friend_count,mutual_friend_count,religion,political,' +
            'can_post,current_location from user where uid = me()',
        locations: 'select page_id,name,latitude,longitude from place where ' +
            'page_id in (select current_location from #me) or page_id ' +
            'in (select hometown_location from #me)'
    };

    FB.api('/fql?q=' + escape(JSON.stringify(queries)), function(mydata) {
        if (!mydata) {
            return cb(self.err());
        }
        if (mydata.error) {
            return cb(self.err(mydata.error));
        }

        var friends, locations;
        for (var i = 0; i < mydata.data.length; i++) {
            if (mydata.data[i].name === "me") {
                friends = mydata.data[i].fql_result_set;
            } else if (mydata.data[i].name === "locations") {
                locations = mydata.data[i].fql_result_set;
            }
        }
        friends = friends.map(function(item) {
            item['title'] = item['name'];
            for (var i = 0; i < locations.length; i++) {
                if (item.current_location !== null && 
                    item.current_location.id === locations[i].page_id) {
                    $.extend(item.current_location, locations[i]);
                }
                if(item.hometown_location !== null && 
                    item.hometown_location.id === locations[i].page_id) {
                    $.extend(item.hometown_location, locations[i]);
                }
            }
            return item;
        });
        return cb(null, friends);
    });
};

FacebookFile.prototype.ppe_search = function(name, cb) {
    var self = this;
    if (self.mime !== 'directory') {
        return cb(E('ENOTDIR'));
    }

    FB.api('/search?type=user&q=' + escape(name), function(myfriends) {
        if (!myfriends) {
            return cb(self.err());
        }
        if (myfriends.error) {
            return cb(self.err(myfriends.error));
        }
        var uids = '0';
        for (var i = 0; i < myfriends.data.length; i++) {
            uids = uids + ', ' + myfriends.data[i].id;
        }
        var queries = {
            friends: 'select name,pic_square,profile_url,about_me,uid,birthday,' +
                'birthday_date,hometown_location,relationship_status,' +
                'significant_other_id,sex,friend_count,mutual_friend_count,religion,' +
                'political,can_post,current_location from user where uid in ' +
                '(' + uids + ')',
            locations: 'select page_id,name,latitude,longitude from place where ' +
                'page_id in (select current_location from #friends) or page_id ' +
                'in (select hometown_location from #friends)'
        };

        FB.api('/fql?q=' + escape(JSON.stringify(queries)), function(myfriends) {
            if (!myfriends) {
                return cb(self.err());
            }
            if (myfriends.error) {
                return cb(self.err(myfriends.error));
            }
            var friends, locations;
            for (var i = 0; i < myfriends.data.length; i++) {
                if (myfriends.data[i].name === "friends") {
                    friends = myfriends.data[i].fql_result_set;
                } else if (myfriends.data[i].name === "locations") {
                    locations = myfriends.data[i].fql_result_set;
                }
            }
            friends = friends.map(function(item) {
                item['title'] = item['name'];
                for (var i = 0; i < locations.length; i++) {
                    if (item.current_location !== null && 
                        item.current_location.id === locations[i].page_id) {
                        $.extend(item.current_location, locations[i]);
                    }
                    if(item.hometown_location !== null && 
                        item.hometown_location.id === locations[i].page_id) {
                        $.extend(item.hometown_location, locations[i]);
                    }
                }
                return item;
            });
            friends = unique_names(friends, {});
            var flist = [];
            for (var i = 0, j = friends.length; i < j; i++) {
                self.files[friends[i].name] = self.getuser(friends[i]);
                flist.push(self.files[friends[i].name]);
            } 
            self.populated = true;
            return cb(null, flist);
        });
    });
};

FacebookFile.prototype.frienddir_readdir = function(opts, cb) {
    var self = this,
        options = $.extend({'reload': false}, opts),
        reload = options['reload'];
    if (self.mime !== 'directory') {
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

    var queries = {
        friends: 'select name,pic_square,profile_url,about_me,uid,birthday,' +
            'birthday_date,hometown_location,relationship_status,' +
            'significant_other_id,sex,friend_count,mutual_friend_count,religion,' +
            'political,can_post,current_location from user where uid in ' +
            '(select uid2 from friend where uid1 = me())',
        locations: 'select page_id,name,latitude,longitude from place where ' +
            'page_id in (select current_location from #friends) or page_id ' +
            'in (select hometown_location from #friends)'
    };

    FB.api('/fql?q=' + escape(JSON.stringify(queries)), function(myfriends) {
        if (!myfriends) {
            return cb(self.err());
        }
        if (myfriends.error) {
            return cb(self.err(myfriends.error));
        }
        var friends, locations;
        for (var i = 0; i < myfriends.data.length; i++) {
            if (myfriends.data[i].name === "friends") {
                friends = myfriends.data[i].fql_result_set;
            } else if (myfriends.data[i].name === "locations") {
                locations = myfriends.data[i].fql_result_set;
            }
        }
        friends = friends.map(function(item) {
            item['title'] = item['name'];
            for (var i = 0; i < locations.length; i++) {
                if (item.current_location !== null && 
                    item.current_location.id === locations[i].page_id) {
                    $.extend(item.current_location, locations[i]);
                }
                if(item.hometown_location !== null && 
                    item.hometown_location.id === locations[i].page_id) {
                    $.extend(item.hometown_location, locations[i]);
                }
            }
            return item;
        });
        friends = unique_names(friends, {});
        for (var i = 0, j = friends.length; i < j; i++) {
            self.files[friends[i].name] = self.getuser(friends[i]);
        } 
        self.populated = true;
        return cb(null, self.files);
    });
};

FacebookFile.prototype.album_readdir = function(opts, cb) {
    var self = this,
        options = $.extend({'reload': false}, opts),
        reload = options['reload'];
    if (self.mime !== 'directory') {
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

    FB.api('/' + self.ident +'/photos', function(myphotos) {
        if (!myphotos) {
            return cb(self.err());
        }
        if (myphotos.error) {
            return cb(self.err(myphotos.error));
        }

        var photos = myphotos.data.map(function(item) {
            item['title'] = item['name'];
            return item;
        });
        photos = unique_names(photos, {});
        for (var i = 0, j = photos.length; i < j; i++) {
            var photo = photos[i];
            var newfile = {
                name: photo.name,
                ident: photo.id.toString(),
                pident: self.ident,
                readable: true,
                writable: true,
                mime: 'image/unknown',
                fs: self.fs,
                owner: self.owner,
                ctime: moment(photo.created_time).valueOf(),
                mtime: moment(photo.updated_time).valueOf(),
                place: photo.place,
                data: {url: photo.images !== undefined? photo.images[0].source: photo.source},
                title: photo.title,
                html: self.create_photo_html(photo),
                likes: photo.likes ? photo.likes.data.length : 0,
                shares: photo.shares ? photo.shares.data.length : 0,
                comments: photo.comments ? photo.comments.data.length : 0,
                raw: photo,
                thumbnail: {
                    url: photo.picture,
                    height: photo.images[photo.images.length-1].height,
                    width: photo.images[photo.images.length-1].width
                },
                homeUrl: photo.link,
                content: photo.source
            };
            if (typeof photo.place !== 'undefined') {
                newfile.geo = {
                    type: 'Point',
                    coordinates: [photo.place.location.longitude, photo.place.location.latitude]
                };
            }
            var newf = new FacebookFile(newfile);
            newf.read = newf.photo_read;
            self.files[photo.name] = newf;
        } 
        self.populated = true;
        return cb(null, self.files);
    });
};

FacebookFile.prototype.wall_readdir = function(options, cb) {
    var self = this;
    return self.post_readdir('/' + self.pident + '/feed', 'wall', options, cb);
};

FacebookFile.prototype.news_readdir = function(options, cb) {
    var self = this;
    return self.post_readdir('/' + self.pident + '/home', 'news', options, cb);
};

FacebookFile.prototype.posts_readdir = function(options, cb) {
    var self = this;
    return self.post_readdir('/' + self.pident + '/posts', 'posts', options, cb);
};

FacebookFile.prototype.status_readdir = function(options, cb) {
    var self = this;
    return self.post_readdir('/' + self.pident + '/statuses', 'statuses', options, cb);
};

FacebookFile.prototype.public_readdir = function(options, cb) {
    var self = this;
    return self.post_readdir('/search', 'public', options, cb);
};

FacebookFile.prototype.post_readdir = function(url, type, options, cb) {
    var self = this,
        options = $.extend({'reload': false}, options);
    if (self.mime !== 'directory') {
        return cb(E('ENOTDIR'));
    }
    var oldest = options['oldest'],
        limit = options['limit'],
        reload = options['reload'];

    var params = [];
    if (oldest !== undefined) {
        // fetch posts from oldest ...facebook expects unix timestamp i.e. seconds
        // we have milliseconds from Date.parse()
        params.push("since=" + oldest/1000);
        if (self.populated === true && !reload) {
            //...  till oldest already fetched
            params.push("until=" + self.oldest/1000);
        }
    } else if (self.populated === true && !reload) {
        // fetch newer posts
        params.push("since=" + self.newest/1000);
    }
    // upper limit
    params.push("limit=" + (limit === undefined ? self.limit : limit));

    url = url + '?' + params.join('&');

    if (self.populated && !reload &&
        (((new Date()).getTime() - self.lastReadDir) < 1000*60) &&
        // if oldest is defined and older than oldest tweet
        // fetch aynway, don't wait for the minute to be up
        (oldest !== undefined ? self.oldest <= oldest : true)) {
        return cb(null, self.files);
    }

    if (reload) {
        delete self.files;
        self.files = {};
        self.populated = false;
    }

    FB.api(url, function(result) {
        if (!result) {
            return cb(self.err());
        }
        if (result.error) {
            return cb(self.err(result.error));
        }

        for (var i = 0, j = result.data.length; i < j; i++) {
            var post = result.data[i];
            var text = post.story || post.message || post.name || post.description;
            var newfile = {
                name: post.id,
                ident: post.id.toString(),
                pident: self.ident,
                readable: true,
                writable: true,
                mime: 'text/json',
                fs: self.fs,
                owner: self.owner,
                ctime: moment(post.created_time).valueOf(),
                mtime: moment(post.updated_time).valueOf(),
                from: post.from.name,
                message: text,
                type: post.type,
                title: text,
                html: self.create_post_html(post),
                likes: post.likes ? post.likes.count : 0,
                shares: post.shares ? post.shares.count : 0,
                comments: post.comments ? post.comments.count : 0,
                raw: post,
                content: JSON.stringify(post),
                thumbnail: {
                    url: post.picture || post.icon,
                    height: 50,
                    width: 50
                }
            };
            if(typeof post.place !== 'undefined') {
                newfile.coords = {
                    lat: post.place.location.latitude,
                    lon: post.place.location.longitude
                };
            }
            if (post.actions && post.actions.length > 0 && post.actions[0].link) {
                newfile.homeUrl = post.actions[0].link;
            }
            var newf = new FacebookFile(newfile);
            newf.read = (type === 'wall' ? newf.wall_read : newf.news_read);
            self.files[post.id] = newf;
            if (self.newest < newf.mtime) {
                self.newest = newf.mtime;
            }
            if (self.oldest > newf.mtime) {
                self.oldest = newf.mtime;
            }
        } 
        self.populated = true;
        self.lastReadDir = new Date().getTime();
        return cb(null, self.files);
    });
};

FacebookFile.prototype.news_read = function(opts, cb) {
    return cb(null, this);
};

FacebookFile.prototype.wall_read = function(opts, cb) {
    return cb(null, this);
};

FacebookFile.prototype.photo_read = function(opts, cb) {
    var self = this,
        cdata = cache.get(self.fs.ident + self.ident, self.mtime),
        data;

    if (cdata) {
        data = cloneCanvas(cdata);
        return cb(null, data);
    }

   var img = new Image(),
       canvas = document.createElement('canvas'),
       ctx = canvas.getContext('2d');

    img.src = self.data.url;
    img.onload = function() {
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0);
        cache.add(self.fs.ident + self.ident, canvas, self.mtime);
        data = cloneCanvas(canvas);
        return cb(null, data);
    };
    /* XXX: on error? */
};

FacebookFile.prototype.albumdir_mkdir = function(name, opts, cb) {
    var self = this;

    FB.api('/' + self.pident + '/albums', 'post', {'name': name, message: 'created by pigshell'}, function(myalbum) {
        if (!myalbum) {
            return cb(self.err());
        }
        if (myalbum.error) {
            return cb(self.err(myalbum.error));
        }
        // reset this folder to fetch data again
        delete self.files;
        self.files = {};
        self.populated = false;

        return cb(null, myalbum);
    });
};

FacebookFile.prototype.comment = function(cb, message) {
    var self = this;
    return self.post('/' + self.ident + '/comments', {'message': message}, cb);
};

FacebookFile.prototype.like = function(cb) {
    var self = this;
    return self.post('/' + self.ident + '/likes', null, cb);
};

FacebookFile.prototype.unlike = function(cb) {
    var self = this;
    return self.del('/' + self.ident + '/likes', cb);
};

FacebookFile.prototype.handler = function(err, res) {
    if (err) {
        return false;
    }
    return true;
};

FacebookFile.prototype.post = function(url, param, cb) {
    var self = this;

    FB.api(url, 'post', param, function(response) {
        if (response === undefined) {
            return cb(self.err());
        }
        if (response.error) {
            return cb(self.err(response.error));
        }
        return cb(null, response);
    });
};

FacebookFile.prototype.rm = function(name, opts, cb) {
    var self = this;
    var rmf = self.files[name];
    if (rmf) {
        return self.del('/' + rmf.ident, cb);
    } else {
        return cb(E('ENOENT'));
    }
};

FacebookFile.prototype.del = function(url, cb) {
    var self = this;

    FB.api(url, 'delete', function(result) {
        if (result === undefined) {
            return cb(self.err());
        }
        if (result.error) {
            return cb(self.err(result.error));
        }
        delete self.files;
        self.files = {};
        self.populated = false;
        return cb(null, result);
    });
};

FacebookFile.prototype.feed_putdir = function(file, clist, opts, cb) {
    var self = this;
    if (isstring(clist[0])) {
        return self.post('/' + self.pident + '/feed', {'message': clist[0]}, cb);
    } else {
        return cb(E('EINVALFILE'));
    }
};

/* clist[0] must be a canvas */
FacebookFile.prototype.album_putdir = function(file, clist, opts, cb) {
    var self = this;
    var content = clist[0];

    if (content === undefined) {
        return cb(E('EWTF'), null);
    }
    if (content.constructor === HTMLCanvasElement) {
        content.toBlob(function(blob) {
            var f = new FormData();
            f.enctype = 'multipart/form-data';
            f.append('source', blob);
            f.append('message', file);
            f.append('access_token', FB.getAccessToken());
            $.ajax(
                {
                    url: 'https://graph.facebook.com/' + self.ident + '/photos',
                    type: 'POST',
                    contentType: false,
                    data: f,
                    processData: false,
                    dataType: 'json'
                }
            ).done(function(data)
                {
                    // reset this folder to fetch data again
                    delete self.files;
                    self.files = {};
                    self.populated = false;

                    return cb(null, data);
                }
            ).fail(function(data)
                {
                    return cb(data);
                }
            );
        });
    } else {
        return cb(E('EINVALFILE'));
    }
};

var FacebookFS = function(myname) {
    var self = this,
        rootfile = {
            name: '/',
            ident: '/',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            htmlClass: 'fbFolder',
            files: {},
            populated: true
        },
        medir = {
            name: 'me',
            ident: 'me',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">me</div>',
            files: {},
            populated: true
        },
        publicdir = {
            name: 'public',
            ident: 'public',
            pident: '/',
            readable: true,
            writable: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">public</div>',
            files: {},
            populated: true
        },
        frienddir = {
            name: 'friends',
            ident: 'friends',
            pident: '/',
            readable: true,
            writable: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">friends</div>',
            files: {},
            populated: false
        },
        walldir = {
            name: 'wall',
            ident: 'wall',
            pident: 'me',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">wall</div>',
            files: {},
            populated: false
        },
        postdir = {
            name: 'posts',
            ident: 'posts',
            pident: 'me',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">posts</div>',
            files: {},
            populated: false
        },
        statusdir = {
            name: 'statuses',
            ident: 'statuses',
            pident: 'me',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">statuses</div>',
            files: {},
            populated: false
        },
        newsdir = {
            name: 'news',
            ident: 'news',
            pident: 'me',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">news</div>',
            files: {},
            populated: false
        },
        albumdir = {
            name: 'albums',
            ident: 'albums',
            pident: 'me',
            readable: true,
            writable: true,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">albums</div>',
            files: {},
            populated: false
        },
        padir = {
            name: 'applications',
            ident: 'applications',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">applications</div>',
            files: {},
            populated: true
        },
        pcdir = {
            name: 'checkins',
            ident: 'checkins',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">checkins</div>',
            files: {},
            populated: true
        },
        pedir = {
            name: 'events',
            ident: 'events',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">events</div>',
            files: {},
            populated: true
        },
        pgdir = {
            name: 'groups',
            ident: 'groups',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">groups</div>',
            files: {},
            populated: true
        },
        ppadir = {
            name: 'pages',
            ident: 'pages',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">pages</div>',
            files: {},
            populated: true
        },
        ppedir = {
            name: 'people',
            ident: 'people',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">people</div>',
            files: {},
            populated: true
        },
        ppldir = {
            name: 'places',
            ident: 'places',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">places</div>',
            files: {},
            populated: true
        },
        ppodir = {
            name: 'posts',
            ident: 'posts',
            pident: 'public',
            readable: true,
            writable: false,
            feed: false,
            fs: self,
            owner: myname,
            mime: 'directory',
            html: '<div class="fbFolder">posts</div>',
            files: {},
            populated: true
        };
    FacebookFS.base.call(self);
    self.ident = 'fb';
    self.root = new FacebookFile(rootfile);
    var med = new FacebookFile(medir);
    var pubd = new FacebookFile(publicdir);
    var wad = new FacebookFile(walldir);
    wad.readdir = wad.wall_readdir;
    wad.putdir = wad.feed_putdir;
    var ned = new FacebookFile(newsdir);
    ned.readdir = ned.news_readdir;
    var pod = new FacebookFile(postdir);
    pod.readdir = pod.posts_readdir;
    pod.putdir = pod.feed_putdir;
    var std = new FacebookFile(statusdir);
    std.readdir = std.status_readdir;
    std.putdir = std.feed_putdir;
    var ald = new FacebookFile(albumdir);
    ald.readdir = ald.albumdir_readdir;
    ald.mkdir = ald.albumdir_mkdir;
    var pad = new FacebookFile(padir);
    var pcd = new FacebookFile(pcdir);
    var ped = new FacebookFile(pedir);
    var pgd = new FacebookFile(pgdir);
    var ppad = new FacebookFile(ppadir);
    var pped = new FacebookFile(ppedir);
    pped.search = pped.ppe_search;
    var ppld = new FacebookFile(ppldir);
    var ppod = new FacebookFile(ppodir);
    med.files = {
        'albums': ald,
        'wall': wad,
        'news': ned,
        'statuses': std,
        'posts': pod
    };
    pubd.files = {
        'applications': pad,
        'checkins': pcd,
        'events': ped,
        'groups': pgd,
        'pages': ppad,
        'people': pped,
        'places': ppld,
        'posts': ppod
    };
    var frd = new FacebookFile(frienddir);
    frd.readdir = frd.frienddir_readdir;
    self.root.files = {'me': med, 'friends': frd, 'public': pubd};
    med.getMyData(function(err, file) {
        if (err === null) {
            var mydata = med.getuser(file[0], false);
            delete mydata.name;
            delete mydata.html;
            $.extend(true, self.root.files['me'], mydata);
        }
    });
};

inherit(FacebookFS, Filesystem);

VFS.register_handler("FacebookFS", FacebookFS);

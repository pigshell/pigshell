/* DOES NOT WORK since Twitter API changed */
/* Copyright (C) 2012 by Coriolis Technologies Pvt Ltd. All rights reserved. */
goog.require('file');
goog.provide('twitter');

var TwitterFile = function() {
    TwitterFile.base.apply(this, arguments);
    var self = this;
    self.lastReadDir = new Date().getTime();
    self.newest = '0';
    self.limit = 20;
    self.oldest = '99999999999999999999';
    self.oldestTime = self.lastReadDir;
};

inherit(TwitterFile, File);

TwitterFile.prototype.getfile = function(file) {
    var self = this;
    var newfile = {
        name: file.name,
        ident: file.id_str,
        pident: self.ident,
        readable: true,
        writable: false,
        mime: 'text/json',
        fs: self.fs,
        ctime: moment(file.created_at).valueOf(),
        mtime: moment(file.created_at).valueOf(),
        owner: file.user.screen_name,
        populated: false,
        files: {},
        title: file.text,
        size: file.text.length,
        retweets: file.retweet_count,
        media: file.entities.media ? file.entities.media : null,
        hashtags: file.entities.hashtags ? file.entities.hashtags : null,
        urls: file.entities.urls ? file.entities.urls : null,
        user_mentions: file.entities.user_mentions ?
            file.entities.user_mentions : null,
        html: [
            '<div class="twFile">',
            '<div class="avatar">',
            '<a href="https://twitter.com/' + file.user.screen_name + '" target="_blank">',
            '<img class="image" height="48px" width="48px" src=',
            file.user.profile_image_url_https,
            '></img>',
            '</a>',
            '</div>',
            '<div class="text">',
            '<div class="tweet">',
            linkify_entities(file),
            '</div>',
            '<div class="from">',
            '<a href="https://twitter.com/' + file.user.screen_name + '" target="_blank">',
            file.user.name,
            '</a>',
            '</div>',
            '<div class="screen_name">',
            '@' + file.user.screen_name,
            '</div>',
            '<div class="time">',
            '<a href="https://twitter.com/' + file.user.screen_name + '/status/' + file.id_str + '" target="_blank">',
            twitter_time(file.created_at),
            '</a>',
            '</div>',
            '</div>',
            '</div>'
        ].join(''),
        raw: file,
        content: file.text,
        thumbnail: {
            url: file.user.profile_image_url_https,
            height: 48,
            width: 48
        },
        homeUrl: 'https://twitter.com/' + file.user.screen_name +
            '/status/' + file.id_str
    };
    if (file.coordinates !== null) {
        newfile.coords = {
            lat: file.coordinates.coordinates[1],
            lon: file.coordinates.coordinates[0]
        };
    }
    return new TwitterFile(newfile);
};

TwitterFile.prototype.getuser = function(file, createSub) {
    var self = this;
    if (createSub === undefined) {
        createSub = true;
    }
    var newfile = {
        name: file.screen_name,
        ident: file.id_str,
        pident: self.ident,
        readable: true,
        writable: false,
        mime: 'directory',
        fs: self.fs,
        ctime: moment(file.created_at).valueOf(),
        mtime: moment(file.created_at).valueOf(),
        owner: file.screen_name,
        populated: false,
        files: {},
        title: file.name,
        followers: file.followers_count || 0,
        following: file.friends_count || 0,
        size: 0,
        html: [
            '<div class="twFile twUser">',
            '<div class="avatar">',
            '<a href="https://twitter.com/' + file.screen_name +
                '" target="_blank">',
            '<img class="image" height="48px" width="48px" src=',
            file.profile_image_url_https,
            '></img>',
            '</a>',
            '</div>',
            '<div class="text">',
            '<div class="from">',
            file.name,
            '</div>',
            '<div class="screen_name">',
            '@',
            file.screen_name,
            '</div>',
            '</div>',
            '</div>'
        ].join(''),
        raw: file,
        content: file.name,
        thumbnail: {
            url: file.profile_image_url_https,
            height: 48,
            width: 48
        },
        homeUrl: 'https://twitter.com/' + file.screen_name
    };
    var newf = new TwitterFile(newfile);
    if (createSub && !newf['raw']['protected']) {
        // if a user is protected, his tweets are not visible
        // don't try to fetch or you will see errors
        var tw =  new TwitterFile({
            name: 'tweets',
            ident: 'tweets',
            pident: newf.ident,
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">tweets</div>',
            files: {},
            owner: newf.name,
            populated: false
        });
        tw.readdir = tw.user_timeline_readdir;
        newf.files['tweets'] = tw;
    }
    newf.populated = true;
    return newf;
};

TwitterFile.prototype.home_timeline_readdir = function(options, cb) {
    var self = this;
    return self.tweet_readdir('statuses/home_timeline', [{include_entities: true}], options, cb);
};

TwitterFile.prototype.user_timeline_readdir = function(options, cb) {
    var self = this;
    return self.tweet_readdir('statuses/user_timeline',
        [{screen_name: self.owner, include_entities: true}], options, cb);
};

TwitterFile.prototype.favorites_readdir = function(options, cb) {
    return this.tweet_readdir('favorites', [{include_entities: true}], options, cb);
};

TwitterFile.prototype.mentions_readdir = function(options, cb) {
    return this.tweet_readdir('statuses/mentions', [{include_entities: true}], options, cb);
};

TwitterFile.prototype.followers_readdir = function(options, cb) {
    return this.user_readdir('followers/ids', options, cb);
};

TwitterFile.prototype.following_readdir = function(options, cb) {
    return this.user_readdir('friends/ids', options, cb);
};

/* This will fetch new tweets if the dir is already populated
 * and the last call is more than a minute old
 */
TwitterFile.prototype.tweet_readdir = function(url, params, opts, cb) {
    var self = this,
        options = $.extend({'reload': false}, opts);
    if (self.mime != 'directory') {
        return cb(E('ENOTDIR'));
    }
    var oldest = options['oldest'],
        limit = options['limit'],
        reload = options['reload'];
    if (oldest !== undefined && self.populated === true && !reload) {
        // fetch older posts than oldest id
        // we can't be sure if the required post has been pulled
        // since twitter uses IDs and we have timestamps
        // so just fetch 200 and hope for the best
        params[0].max_id = self.oldest;
    } else if (self.populated === true && !reload) {
        // fetch newer posts
        params[0].since_id = self.newest;
    }
    params[0].count = (limit === undefined ?
        // if oldest is defined and limit is not, fetch 200
        (oldest !== undefined ? 200 : self.limit) :
        // upper limit should be <=200 >= 20
        Math.max(self.limit, Math.min(limit, 200)));

    if (self.populated && !reload &&
        (((new Date()).getTime() - self.lastReadDir) < 1000*60) &&
        // if oldest is defined and older than oldest tweet
        // fetch aynway, don't wait for the minute to be up
        (oldest !== undefined ? self.oldestTime <= oldest : true)) {
        return cb(null, self.files);
    }

    if (reload) {
        delete self.files;
        self.files = {};
        self.populated = false;
    }

    twttr.anywhere._instances[twttr.anywhere.versions[
        twttr.anywhere.versions.length-1]].contentWindow.twttr.anywhere.remote.call(
        url, params,
        function(files) {
            if (files === null) {
                return cb(E('EACCES'), null);
            }
            var uniqueFiles = unique_names(files, {field: 'id_str'});
            for (var i = 0; i < uniqueFiles.length; i++) {
                var file = uniqueFiles[i];
                self.files[file.name] = self.getfile(file);
                if (compareStringAsUInt(self.newest, file.id_str) < 0) {
                    self.newest = file.id_str;
                }
                if (compareStringAsUInt(self.oldest, file.id_str) > 0) {
                    self.oldest = file.id_str;
                    self.oldestTime = file.ctime;
                }
            }
            self.populated = true;
            self.lastReadDir = new Date().getTime();
            return cb(null, self.files);
        }
    );
};

TwitterFile.prototype.user_readdir = function(resource, opts, cb) {
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

    twttr.anywhere._instances[twttr.anywhere.versions[
        twttr.anywhere.versions.length-1]].contentWindow.twttr.anywhere.remote.call(
        resource,
        [{screen_name: self.owner}], 
        function(list) {
            if (list !== null && list.ids.length > 0 ) {
                var listParts = getGroups(list.ids, 100);
                async.forEachSeries(
                    listParts,
                    function(listPart, acb) {
                        twttr.anywhere._instances[twttr.anywhere.versions[
                            twttr.anywhere.versions.length-1]].
                            contentWindow.twttr.anywhere.remote.call(
                            'users/lookup',
                            [{user_id: listPart.join(',')}],
                            function(files) {
                                if (files !== null) {
                                    for (var i = 0; i < files.length; i++) {
                                        self.files[files[i].screen_name] =
                                            self.getuser(files[i]);
                                    }
                                }
                                return soguard(null, acb.bind(this, null));
                            }
                        );
                    },
                    function(err) {
                        if (err === null) {
                            self.populated = true;
                        }
                        return cb(err, self.files);
                    }
                );
            } else {
                self.populated = true;
                return cb(null, self.files);
            }
        }
    );
};

TwitterFile.prototype.clearfolder = function() {
    var self = this;
    delete self.files;
    self.files = {};
    self.populated = false;
};

/* Used to tweet.
 * clist[0] must be the tweet
 * with all the attendant restrictions
 */
TwitterFile.prototype.tweet_putdir = function(file, clist, cb) {
    var self = this;
    if (clist.length > 0 && isstring(clist[0])) {
        twttr.anywhere._instances[twttr.anywhere.versions[
            twttr.anywhere.versions.length-1]].
            contentWindow.twttr.anywhere.remote.call(
            'statuses/update', [{'status': clist[0]}],
            function(result) {
                self.clearfolder();
                return cb(null, result);
            }
        );
    } else {
        return cb(E('EINVALFILE'));
    }
};

TwitterFile.prototype.tweet_rm = function(name, cb) {
    var self = this;
    var rmf = self.files[name];
    if (rmf) {
        twttr.anywhere._instances[twttr.anywhere.versions[
            twttr.anywhere.versions.length-1]].
            contentWindow.twttr.anywhere.remote.call(
            'statuses/destroy/' + rmf.ident,[{'id': rmf.ident}],
            function(result) {
                self.clearfolder();
                return cb(null, result);
            }
        );
    } else {
        return cb(E('ENOENT'));
    }
};

TwitterFile.prototype.read = function(opts, cb) {
    return cb(null, this);
};

var TwitterFS = function(myscreenname) {
    var self = this,
        rootfile = {
            name: '/',
            ident: '/',
            pident: '/',
            readable: true,
            writable: true,
            fs: self,
            mime: 'directory',
            htmlClass: 'twFolder',
            files: {},
            owner: myscreenname,
            populated: true
        },
        me = {
            name: 'me',
            ident: 'me',
            pident: '/',
            readable: true,
            writable: false,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">me</div>',
            files: {},
            owner: myscreenname,
            populated: true
        },
        home_timeline = {
            name: 'home',
            ident: 'home',
            pident: '/',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">home</div>',
            files: {},
            owner: myscreenname,
            populated: false
        },
        user_timeline = {
            name: 'tweets',
            ident: 'tweets',
            pident: '/',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">tweets</div>',
            files: {},
            owner: myscreenname,
            populated: false
        },
        favorites = {
            name: 'favorites',
            ident: 'favorites',
            pident: '/',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">favorites</div>',
            files: {},
            owner: myscreenname,
            populated: false
        },
        followers = {
            name: 'followers',
            ident: 'followers',
            pident: '/',
            readable: true,
            writable: false,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">followers</div>',
            files: {},
            owner: myscreenname,
            populated: false
        },
        following = {
            name: 'following',
            ident: 'following',
            pident: '/',
            readable: true,
            writable: false,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">following</div>',
            files: {},
            owner: myscreenname,
            populated: false
        },
        mentions = {
            name: 'mentions',
            ident: 'mentions',
            pident: '/',
            readable: true,
            writable: false,
            feed: true,
            fs: self,
            mime: 'directory',
            html: '<div class="twFolder">mentions</div>',
            files: {},
            owner: myscreenname,
            populated: false
        };
    TwitterFS.base.call(self);
    self.ident = 'tw';
    var h = new TwitterFile(home_timeline);
    h.readdir = h.home_timeline_readdir;
    var u = new TwitterFile(user_timeline);
    u.readdir = u.user_timeline_readdir;
    u.putdir = u.tweet_putdir;
    u.rm = u.tweet_rm;
    var f = new TwitterFile(favorites);
    f.readdir = f.favorites_readdir;
    var fwers = new TwitterFile(followers);
    fwers.readdir = fwers.followers_readdir;
    var fwing = new TwitterFile(following);
    fwing.readdir = fwing.following_readdir;
    var m = new TwitterFile(mentions);
    m.readdir = m.mentions_readdir;
    var med = new TwitterFile(me);
    med.files = {
        'home': h,
        'tweets': u,
        'favorites': f,
        'mentions': m
    };
    self.root = new TwitterFile(rootfile);
    self.root.files = {
        'me': med,
        'followers': fwers,
        'following': fwing
    };
    twttr.anywhere._instances[twttr.anywhere.versions[
        twttr.anywhere.versions.length-1]].
        contentWindow.twttr.anywhere.remote.call(
        'users/show',
        [{screen_name: myscreenname}],
        function(file) {
            var mydata = med.getuser(file, false);
            delete mydata.name;
            delete mydata.html;
            $.extend(true, self.root.files['me'], mydata);
        }
    );
};

inherit(TwitterFS, Filesystem);

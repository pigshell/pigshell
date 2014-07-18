
/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * Auth subsystem.
 *
 * The /auth fs user interface is pretty nice. Everything else is pretty
 * horrible.
 * TODO Auth providers need a better API, once we've seen all the worst cases.
 */

var Auth = {
    authlist: {},

    lookup: function(path, opts) {
        var comps = path.split('/'),
            cur = this.authlist;

        for (var i = 0, len = comps.length; cur && i < len; i++) {
            var comp = comps[i];
            if (comp === '') {
                continue;
            }
            cur = cur[comp];
        }
        return cur;
    },

    register: function(name, obj) {
        this.authlist[name] = obj;
    },

    unregister: function(name) {
        delete this.authlist[name];
    }
};

var GoogleOAuth2 = {
    authdata: {
        tokens: {}
    },

    init: function() {
        var self = this,
            a = self.authdata;

        $(document).on("click", ".googleoauth2-new", function() {
            var el = $(this).parent();

            self.login('', {}, function(err, res) {
                if (err) {
                    el.append("<br /><span>" + err_stringify(err) + "</span>");
                } else {
                    el.append("<br /><span>Logged in as: " + res.userinfo.email + "</span>");
                }
            });
        });
        a.__defineGetter__('login', function() {
            return { html: '<button class="googleoauth2-new">New Google User</button>' };
        });
        a.__defineSetter__('logout', function(name) {
            self.logout(name);
        });
        Auth.register("google-oauth2", a);
    },

    login: function(name, opts, cb) {
        return this.get_token(name, opts, cb);
    },

    logout: function(name, opts, cb) {
        var self = this,
            t = this.authdata.tokens[name];

        if (t) {
            if (t._timer) {
               clearTimeout(t._timer);
            }
            delete this.authdata.tokens[name];
        }
        self.cache_remove_user(name);
        return cb(null, null);
    },
        
    cache_list_users: function() {
        var userstr = localStorage['google-oauth2-users'] || '',
            userlist = userstr ? userstr.split(',') : [];

        return userlist;
    },

    cache_remove_user: function(name) {
        var userstr = localStorage['google-oauth2-users'] || '',
            userlist = userstr ? userstr.split(',') : [],
            i = userlist.indexOf(name);

        if (i !== -1) {
            userlist.splice(i, 1);
            localStorage['google-oauth2-users'] = userlist.join(',');
        }
    },

    cache_add_user: function(name) {
        var userstr = localStorage['google-oauth2-users'] || '',
            userlist = userstr ? userstr.split(',') : [],
            i = userlist.indexOf(name);

        if (i === -1) {
            userlist.push(name);
            localStorage['google-oauth2-users'] = userlist.join(',');
        }
    },

    get_token: function(name, opts, cb) {
        var self = this,
            opts2 = {
                'client_id': '1062433776402.apps.googleusercontent.com',
                'scope': [ 'https://www.googleapis.com/auth/userinfo.profile',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/drive',
                    'https://picasaweb.google.com/data/' ].join(' '),
                'redirect_uri': 'http://pigshell.com/common/oauth2_redirect.html'
            },
            options = {oauth2: opts2},
            go2, iframe;

        if (name) {
            opts2['login_hint'] = name;
            opts2['approval_prompt'] = 'auto';
            iframe = true;
        } else {
            iframe = false;
        }
        options.url = 'https://accounts.google.com/o/oauth2/auth';
        go2 = new OAuth2(options);
        go2.onlogin = function(msg) {
            var err = msg['error'] || "OAuth2 login failed",
                access_token = msg['access_token'],
                expires = +msg['expires_in'];
            if (!access_token) {
                if (name) {
                    self.cache_remove_user(name);
                }
                return cb(err);
            }
            self.update_token(access_token, expires, cb);
        };
        go2.login(iframe);
    },

    update_token: function(access_token, expires, cb) {
        var self = this;

        expires = expires || 3600;
        //console.log('got token: ' + access_token + ' : ' + expires);
        $.getJSON('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=' + access_token, function(userinfo) {
        /* XXX Error case? */
            var t = {
                userinfo: userinfo,
                access_token: access_token,
                expires: Date.now() + expires * 1000,
                _jfs: ["userinfo", "access_token", "expires"]
            },
            ag = Auth.lookup("google-oauth2", {});
            ag["tokens"][userinfo.email] = t;
            //console.log('userinfo ', userinfo);
            t["_timer"] = setTimeout(self.get_token.bind(self, userinfo.email,
                {}, function(){}), (expires * 0.8) * 1000);
            self.cache_add_user(userinfo.email);
            return cb(null, t);
        }).fail(function() {
            return cb("Userinfo error - invalid access token?");
        });
    }
};

GoogleOAuth2.init();

var DropboxOAuth2 = {
    authdata: {
        tokens: {}
    },

    init: function() {
        var self = this,
            a = self.authdata;

        $(document).on("click", ".dropboxoauth2-new", function() {
            var el = $(this).parent();

            self.login('', {}, function(err, res) {
                if (err) {
                    el.append("<br /><span>" + err_stringify(err) + "</span>");
                } else {
                    el.append("<br /><span>Logged in as: " + res.userinfo.email + "</span>");
                }
            });
        });
        a.__defineGetter__('login', function() {
            return { html: '<button class="dropboxoauth2-new">New Dropbox User</button>' };
        });
        a.__defineSetter__('logout', function(name) {
            self.logout(name);
        });
        Auth.register("dropbox-oauth2", a);
    },

    login: function(name, opts, cb) {
        var self = this,
            data = name ? self.cache_get_user(name) : {};

        if (!data.access_token) {
            return self.get_token(name, opts, cb);
        }
        return self.check_token(data.access_token, function(err, res) {
            if (err) {
                self.cache_remove_user(name);
                return self.get_token(name, opts, cb);
            } else {
                return cb(null, res);
            }
        });
    },

    logout: function(name, opts, cb) {
        var self = this,
            t = this.authdata.tokens[name],
            at = t.access_token;

        if (t) {
            delete this.authdata.tokens[name];
        }
        self.cache_remove_user(name);
        $.getJSON('https://api.dropbox.com/1/disable_access_token?access_token=' + at, function() {
            return cb(null, null);
        }).fail(function() {
            return cb('Failed to disable access token');
        });
    },

    cache_list_users: function() {
        var userstr = localStorage['dropbox-oauth2-users'] || '',
            userlist = parse_json(userstr) || {};

        return Object.keys(userlist);
    },

    cache_remove_user: function(name) {
        var userstr = localStorage['dropbox-oauth2-users'] || '',
            userlist = parse_json(userstr) || {};

        delete userlist[name];
        localStorage['dropbox-oauth2-users'] = JSON.stringify(userlist);
    },

    cache_add_user: function(name, data) {
        var userstr = localStorage['dropbox-oauth2-users'] || '',
            userlist = parse_json(userstr) || {};

        userlist[name] = data;
        localStorage['dropbox-oauth2-users'] = JSON.stringify(userlist);
    },

    cache_get_user: function(name) {
        var userstr = localStorage['dropbox-oauth2-users'] || '',
            userlist = parse_json(userstr) || {};

        return userlist[name] || {};
    },

    check_token: function(access_token, cb) {
        var self = this;
        $.getJSON('https://api.dropbox.com/1/account/info?access_token=' + access_token, function(userinfo) {
            var t = {
                userinfo: userinfo,
                access_token: access_token,
                _jfs: ["userinfo", "access_token"]
            },
            ag = Auth.lookup("dropbox-oauth2", {});
            ag["tokens"][userinfo.email] = t;
            self.cache_add_user(userinfo.email, {access_token: access_token});
            return cb(null, t);
        }).fail(function() {
            return cb('Invalid access token');
        });
    },

    get_token: function(name, opts, cb) {
        var self = this,
            opts2 = {
                'client_id': 'ctc1idg9mu021c5',
                'redirect_uri': 'https://pigshell.com/common/oauth2_redirect_https.html'
            },
            options = {oauth2: opts2},
            go2;

        if (name === '') {
            opts2['force_reapprove'] = 'true';
        }
        options.url = 'https://www.dropbox.com/1/oauth2/authorize';
        go2 = new OAuth2(options);
        go2.onlogin = function(msg) {
            var err = msg['error'] || "OAuth2 login failed",
                access_token = msg['access_token'];
            if (!access_token) {
                return cb(err);
            } else {
                return self.check_token(access_token, cb);
            }
        };
        go2.login(false);
    }
};

DropboxOAuth2.init();


/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * Auth subsystem.
 */

var Auth = {
};

var OA2Client = function(opts) {
    this.opts = $.extend({}, this.constructor.defaults, opts);
    this.authdata = {};
    Auth[this.name] = this.authdata;
};

OA2Client.prototype.login = function(name, opts, cb) {
    throw "Implement me";
};

OA2Client.prototype.logout = function(name, opts, cb) {
    this.cache_remove(name);
};

OA2Client.prototype.users = function() {
    return Object.keys(this.authdata);
};

OA2Client.prototype.get_token = function(name) {
    var a = this.authdata[name] || {};
    return a.access_token;
};

OA2Client.prototype.get_auth = function(name) {
    return this.authdata[name];
};

OA2Client.prototype.cache_list = function() {
    var str = localStorage[this.opts.cache] || "";
    return parse_json(str) || {};
};

OA2Client.prototype.cache_add = function(name, data) {
    var cache = this.cache_list();
    cache[name] = data;
    localStorage[this.opts.cache] = JSON.stringify(cache);
};

OA2Client.prototype.cache_remove = function(name) {
    var cache = this.cache_list();
    delete cache[name];
    localStorage[this.opts.cache] = JSON.stringify(cache);
};

var GoogleOA2 = function(opts) {
    this.name = "google";
    GoogleOA2.base.call(this, opts);
};

inherit(GoogleOA2, OA2Client);

GoogleOA2.defaults = {
    cache: "google-oauth2",
    client_id: "1062433776402.apps.googleusercontent.com",
    scope_map: {
        basic: "https://www.googleapis.com/auth/userinfo.profile",
        email: "https://www.googleapis.com/auth/userinfo.email",
        drive: "https://www.googleapis.com/auth/drive",
        picasa: "https://picasaweb.google.com/data/"
    },
    scope: ["basic", "email", "drive", "picasa"],
    auth_url: "https://accounts.google.com/o/oauth2/auth",
    redirect_uri: pigshell.site.url + "/common/oauth2_redirect.html"
};


/*
 * @param {string} name - Login name
 * @param {string[]} opts.scope - List of scopes
 * @param {boolean} opts.force - Force reauthentication
 */

GoogleOA2.prototype.login = function(name, opts, cb) {
    var self = this,
        oauth2 = {client_id: self.opts.client_id, redirect_uri: self.opts.redirect_uri},
        opts2 = {},
        scope = self.opts.scope,
        display = "iframe";

    if (opts.force || !name) {
        display = "popup";
        oauth2.approval_prompt = "force";
    }
        
    if (name) {
        oauth2.login_hint = name;
        var cache = self.cache_list(),
            centry = cache[name] || {};
        scope = opts.scope || centry.scope || scope;
        if (!opts.force) {
            display = "iframe";
            oauth2.approval_prompt = "auto";
        }
    }
    opts2.url = self.opts.auth_url;
    oauth2.scope = scope.map(function(s) { return self.opts.scope_map[s]; })
        .filter(function(s) { return !!s; })
        .join(" ");
    opts2.oauth2 = oauth2;

    var go2 = new OAuth2(opts2);
    go2.login(display, ef(cb, function(msg) {
        var err = msg.error || "OAuth2 login failed",
            access_token = msg["access_token"],
            expires = +msg["expires_in"] || self.opts.expires_in || 3600;
        if (!access_token) {
            if (name) {
                self.cache_remove(name);
            }
            return cb(err);
        }
        update_userinfo(access_token, expires);
    }));

    function update_userinfo(access_token, expires) {
        self.userinfo(access_token, function(err, res) {
            if (err) {
                if (name) {
                    self.cache_remove(name);
                }
                return cb("Userinfo failed");
            }
            var t = {
                    userinfo: res,
                    access_token: access_token,
                    expires: Date.now() + expires * 1000,
                    _jfs: ["userinfo", "access_token", "expires"]
                };
            self.authdata[res.email] = t;
            t["_timer"] = setTimeout(self.login.bind(self, name,
                {}, function(){}), (expires * 0.8) * 1000);
            var centry = {
                scope: scope,
                access_token: access_token,
                expires: expires
            };
            self.cache_add(res.email, centry);
            return cb(null, t);
        });
    }
};

GoogleOA2.prototype.userinfo = function(access_token, cb) {
    $.getJSON('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=' + access_token, function(userinfo) {
        return cb(null, userinfo);
    }).fail(function() {
        return cb("Invalid access token?");
    });
};

VFS.register_handler("GoogleAuth", new GoogleOA2());
VFS.register_auth_handler("google", "GoogleAuth");

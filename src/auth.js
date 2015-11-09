
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

OA2Client.prototype.get_params = function(name, centry, opts) {
    var self = this,
        oauth2 = {client_id: self.opts.client_id, redirect_uri: self.opts.redirect_uri},
        opts2 = {},
        scope = self.opts.scope,
        display = "iframe",
        cscope = centry.scope,
        force = opts.force || !name;

    if (name) {
        scope = opts.scope || centry.scope || scope;
        if (scope && opts.scope && opts.scope.sort().toString() !==
            scope.sort().toString()) {
            force = true;
        }
    }
    if (force) {
        display = "popup";
    }

    opts2.url = self.opts.auth_url;
    opts2.force = force;
    opts2.display = display;
    oauth2.scope = scope.map(function(s) { return self.opts.scope_map[s]; })
        .filter(function(s) { return !!s; })
        .join(self.opts.scope_sep);
    opts2.oauth2 = oauth2;

    return opts2;
};

OA2Client.prototype.login = function(name, opts, cb) {
    var self = this,
        cache = self.cache_list(),
        centry = cache[name] || {},
        opts2 = self.get_params(name, centry, opts),
        now = Date.now() / 1000,
        exp = isnumber(centry.expires) && centry.expires - 300 < now;

    assert("OA2Client.login.1", opts2.force || (name && centry.access_token),
        centry);

    if (opts2.force || exp) {
        return do_login();
    }
    do_login2(centry.access_token, centry.expires);
    
    function error(err) {
        if (name) {
            self.cache_remove(name);
        }
        return cb(err);
    }
    function do_login() {
        var go2 = new OAuth2(opts2);

        go2.login(ef(error, function(msg) {
            var access_token = msg.access_token,
                expires_in = +msg.expires_in || self.opts.expires_in ||
                    "unknown",
                expires = isnumber(expires_in) ?
                    Date.now() / 1000 + expires_in : expires_in;
            if (!access_token) {
                return error("OAuth2 login failed");
            }
            do_login2(access_token, expires);
        }));
    }

    function do_login2(access_token, expires) {
        self.userinfo(access_token, ef(error, function(res) {
            var t = {
                    userinfo: res,
                    access_token: access_token,
                    expires: expires,
                    _jfs: ["userinfo", "access_token", "expires"]
                },
                old = self.authdata[res.email],
                now = Date.now() / 1000;
            if (old && old._timer) {
                clearTimeout(old._timer);
            }

            if (isnumber(expires) && expires - now > 600) {
                t._timer = setTimeout(self.login.bind(self, name,
                    opts, function(){}), (expires - now - 300) * 1000);
            }
            self.authdata[res.email] = t;
            var centry = {
                scope: opts2.scope,
                access_token: access_token,
                expires: expires
            };
            self.cache_add(res.email, centry);
            return cb(null, t);
        }));
    }
};

OA2Client.prototype.logout = function(name, opts, cb) {
    this.cache_remove(name);
};

OA2Client.prototype.users = function() {
    return Object.keys(this.authdata);
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

OA2Client.prototype.userinfo = function(access_token, cb) {
    $.getJSON(this.opts.userinfo_url + access_token, function(userinfo) {
        //console.log("USERINFO", userinfo);
        return cb(null, userinfo);
    }).fail(function() {
        return cb("Invalid access token?");
    });
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
    scope_sep: " ",
    scope: ["basic", "email", "drive", "picasa"],
    auth_url: "https://accounts.google.com/o/oauth2/auth",
    userinfo_url: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=",
    redirect_uri: pigshell.site.url + "/common/oauth2_redirect.html"
};


GoogleOA2.prototype.get_params = function(name, centry, opts) {
    var opts2 = GoogleOA2.base.prototype.get_params.call(this, name, centry,
        opts);

    if (opts.force) {
        opts2.oauth2.approval_prompt = "force";
    }
    if (name) {
        opts2.oauth2.login_hint = name;
    }
    return opts2;
};

VFS.register_handler("GoogleAuth", new GoogleOA2());
VFS.register_auth_handler("google", "GoogleAuth");

var DropboxOA2 = function(opts) {
    this.name = "dropbox";
    DropboxOA2.base.call(this, opts);
};

inherit(DropboxOA2, OA2Client);

DropboxOA2.defaults = {
    cache: "dropbox-oauth2",
    client_id: "ctc1idg9mu021c5",
    scope_map: {},
    scope: [],
    scope_sep: " ",
    auth_url: "https://www.dropbox.com/1/oauth2/authorize",
    userinfo_url: "https://api.dropbox.com/1/account/info?access_token=",
    redirect_uri: "https://" + pigshell.site.name + "/common/oauth2_redirect_https.html"
};

DropboxOA2.prototype.get_params = function(name, centry, opts) {
    var opts2 = DropboxOA2.base.prototype.get_params.call(this, name, centry,
        opts);

    if (!name) {
        opts2.oauth2.force_reapprove = "true";
    }
    return opts2;
};

VFS.register_handler("DropboxAuth", new DropboxOA2());
VFS.register_auth_handler("dropbox", "DropboxAuth");

var WindowsOA2 = function(opts) {
    this.name = "windows";
    WindowsOA2.base.call(this, opts);
};

inherit(WindowsOA2, OA2Client);

WindowsOA2.defaults = {
    cache: "windows-oauth2",
    client_id: "0000000048175E9E",
    scope_map: {
        signin: "wl.signin",
        basic: "wl.basic",
        onedrive: "wl.skydrive_update",
        email: "wl.emails"
    },
    scope: ["signin", "basic", "onedrive", "email"],
    scope_sep: ",",
    auth_url: "https://login.live.com/oauth20_authorize.srf",
    userinfo_url: "https://apis.live.net/v5.0/me?access_token=",
    redirect_uri: pigshell.site.url + "/common/oauth2_redirect.html"
};


WindowsOA2.prototype.get_params = function(name, centry, opts) {
    var opts2 = WindowsOA2.base.prototype.get_params.call(this, name, centry,
        opts);

    return opts2;
};

WindowsOA2.prototype.userinfo = function(access_token, cb) {
    WindowsOA2.base.prototype.userinfo.call(this, access_token, ef(cb, function(userinfo) {
        userinfo.email = userinfo.emails.account || userinfo.id + "@windowslive";
        return cb(null, userinfo);
    }));
};

VFS.register_handler("WindowsAuth", new WindowsOA2());
VFS.register_auth_handler("windows", "WindowsAuth");


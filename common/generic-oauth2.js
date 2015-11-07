/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 *
 * A generic OAuth2 client based on
 * https://github.com/timdream/google-oauth2-web-client and
 * http://adodson.com/hello.js/
 *
 * We need to extend the former for multiple OAuth2 users, with hints from the
 * latter regarding quirks of various providers.
 *
 * This file is shared across multiple releases, so it should be modified with
 * great care, keeping in mind backward compatibility with all the releases
 * which use it. One of the ways we do this is to keep it standalone - not
 * dependent on any external libraries like jQuery.
 */

function OAuth2(options) {
    this.options = {};
    var oauth2 = options.oauth2;
    if (!options || !oauth2 || !options.url) {
        throw 'options not set';
    }
    this.oauth2 = oauth2;
    if (!oauth2.client_id) {
        throw "client_id must be set";
    }
    oauth2.response_type = 'token';
    this.popupWidth = options.popupWidth || 500;
    this.popupHeight = options.popupHeight || 400;
    this.timeout = options.timeout || 300;
    this.url = options.url;
    this.onlogin = this.popup = this.iframe = this.timer = null;
    this.name = 'oauth2-win';
}

OAuth2.sendmsg = function() {
};

OAuth2.prototype.recvmsg = function(event) {
    if (event.origin !== "http://" + window.location.hostname &&
        event.origin !== "https://" + window.location.hostname) {
        return;
    }
    var msg = event.data;
    if (!msg || (msg.hash === undefined || msg.search === undefined ||
        !msg.name || msg.name !== this.name)) {
        return;
    }
    var hp = parseqs(msg.hash.slice(1)),
        sp = parseqs(msg.search.slice(1));

    if (!hp['access_token'] && !hp['error'] && !sp['error']) {
        console.log("Unknown message: ", msg);
        return this.process_msg({'error': 'Unknown'});
    }
    this.process_msg(sp.error ? sp : hp);
};

function makeqs(opts) {
    var str = [];
    for (var o in opts) {
        if (opts.hasOwnProperty(o)) {
            str.push(encodeURIComponent(o) + '=' + encodeURIComponent(opts[o]));
        }
    }
    return str.join('&');
}

function parseqs(str) {
    var qp = str.split('&'),
        params = {};

    qp.forEach(function(el) {
        var pv = el.split('=');
        if (pv.length === 2) {
            params[pv[0]] = pv[1];
        }
    });
    return params;
}

OAuth2.prototype.login = function(immediate) {
    var self = this;
    self.state = Math.random().toString(36).substr(2);
    self.oauth2['state'] = self.state;
    self.name = self.name + self.state;
    var qs = makeqs(self.oauth2),
        url = self.url + '?' + qs;

    self.listener = self.recvmsg.bind(self);
    window.addEventListener("message", self.listener, false);
    self.timer = setTimeout(function() {
        self.cleanup();
        if (self.onlogin) {
            return self.onlogin({error: "Timed out"});
        }
    }, self.timeout * 1000);

    if (immediate) {
        var iframe = self.iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.hidden = true;
        iframe.width = iframe.height = 1;
        iframe.name = self.name;
        document.body.appendChild(iframe);
        return;
    }
    var left = window.screenX + (window.outerWidth / 2) -
        (self.popupWidth / 2),
        top = window.screenY + (window.outerHeight / 2) -
        (self.popupHeight / 2),
        features = 'width=' + self.popupWidth +
                   ',height=' + self.popupHeight +
                   ',top=' + top +
                   ',left=' + left +
                   ',location=yes,toolbar=no,menubar=no';
    self.popup = window.open(url, self.name, features);
};

OAuth2.prototype.process_msg = function(msg) {
    var self = this;

    self.cleanup();
    if (msg.state && msg.state !== self.state) {
        msg = {'error': 'State mismatch'};
    }
    if (self.onlogin) {
        self.onlogin(msg);
    }
};

OAuth2.prototype.cleanup = function() {
    var self = this;

    if (self.iframe) {
        document.body.removeChild(self.iframe);
        self.iframe = null;
    }
    if (self.popup) {
        self.popup.close();
        self.popup = null;
    }
    if (self.timer) {
        clearTimeout(self.timer);
        self.timer = null;
    }
    if (window.__activeOA2) {
        delete window.__activeOA2[self.name];
    }
    if (self.listener) {
        window.removeEventListener("message", self.listener, false);
    }
};

function sendmsg() {
    var opener = window.opener || window.parent;

    if (!opener) {
        console.log("Could not find opener?!");
        return;
    }
    var msg = {
        name: window.name || '',
        search: window.location.search || '',
        hash: window.location.hash || ''
    };
    opener.postMessage(msg, "http://" + window.location.hostname);
}

if (window.name.match(/^oauth2-win/)) {
    sendmsg();
}

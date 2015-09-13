/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * HttpTX is the http transport layer. Uses XHR2 to get stuff
 *
 * opts is an object containing:
 * headers: object containing headers
 * responseType: string with "", "arraybuffer", "blob", "json", "document",
 * or "text"
 */

var HttpTX = function(o) {
    var self = this,
        opts = $.extend({}, HttpTX.defaults, o);

    self.uri = opts.uri;
    self.fallthrough = opts.fallthrough;

    if (self.uri && self.uri[self.uri.length - 1] != "/") {
        self.uri += "/";
    }
};

HttpTX.defaults = {
    "uri": "",
    "fallthrough": false
};

HttpTX.prototype.do_xhr = function(op, url, data, opts, cb, use_proxy) {
    var self = this,
        xhr = new XMLHttpRequest(),
        headers = opts.headers || {},
        rt = opts.responseType || "",
        params = opts.params ? $.param(opts.params) : '',
        proxy_url = (self.fallthrough && !use_proxy) ? '' : self.uri,
        u = params ? proxy_url + url + '?' + params : proxy_url + url,
        context = (opts.context && opts.context._abortable) ? opts.context : null;

    xhr.open(op, u, true);
    for (var prop in headers) {
        xhr.setRequestHeader(prop, headers[prop]);
    }
    xhr.responseType = rt;
    if (context) {
        context._abortable.push(xhr);
    }

    function removeself() {
        if (context) {
            var index = context._abortable.indexOf(xhr);
            if (index !== -1) {
                context._abortable.splice(index, 1);
            }
        }
    }

    function catcher(err, res) {
        proc.current(context);
        return cb(err, res);
    }

    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) {
            return;
        }
        if (xhr.status === 0) {
            removeself();
            if (self.fallthrough && !use_proxy) {
                return self.do_xhr(op, url, data, opts, cb, true);
            }
            return catcher({code: xhr.status, msg: "Cross-origin request denied (check if psty is running)"}, xhr);
        }
        if (xhr.status >= 400) {
            removeself();
            return catcher({code: xhr.status, msg: xhr.statusText}, xhr);
        }
        removeself();
        return catcher(null, xhr);
    };
    proc.current(null);
    if (data) {
        xhr.send(data);
    } else {
        xhr.send();
    }
};

HttpTX.prototype.HEAD = function(url, opts, cb) {
    return this.do_xhr('HEAD', url, null, opts, cb);
};

HttpTX.prototype.GET = function(url, opts, cb) {
    return this.do_xhr('GET', url, null, opts, cb);
};

HttpTX.prototype.POST = function(url, data, opts, cb) {
    return this.do_xhr('POST', url, data, opts, cb);
};

HttpTX.prototype.PATCH = function(url, data, opts, cb) {
    return this.do_xhr('PATCH', url, data, opts, cb);
};

HttpTX.prototype.PUT = function(url, data, opts, cb) {
    return this.do_xhr('PUT', url, data, opts, cb);
};

HttpTX.prototype.DELETE = function(url, opts, cb) {
    return this.do_xhr('DELETE', url, null, opts, cb);
};

VFS.register_handler("HttpTX", HttpTX);
VFS.register_tx_handler("direct", "HttpTX", {"uri": ""});
VFS.register_tx_handler("proxy", "HttpTX", {"uri": "http://localhost:50937/"});
VFS.register_tx_handler("fallthrough", "HttpTX", {"uri": "http://localhost:50937/", "fallthrough": true});

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * HttpTX is the http transport layer. Uses XHR2 to get stuff
 * First get direct stuff working, then implement Proxies, YQL etc.
 *
 * opts is an object containing:
 * headers: object containing headers
 * responseType: string with "", "arraybuffer", "blob", "json", "document",
 * or "text"
 * withCredentials:
 *
 */

var HttpTX = function(opts) {
    var self = this;

    self.opts = opts;
    self.proxy_url = (opts && opts.proxy_url) ? opts.proxy_url : '';

    if (self.proxy_url && self.proxy_url[self.proxy_url.length - 1] != '/') {
            self.proxy_url += '/';
    }
};

HttpTX.dict = {'direct': new HttpTX({}),
    'proxy': new HttpTX({proxy_url: 'http://localhost:50937/'})
};

HttpTX.lookup = function(name) {
    return HttpTX.dict[name];
};

HttpTX.prototype.do_xhr = function(op, url, data, opts, cb) {
    var self = this,
        xhr = new XMLHttpRequest(),
        headers = opts.headers || {},
        rt = opts.responseType || "",
        params = opts.params ? $.param(opts.params) : '',
        proxy_url = (opts.tx && opts.tx === 'direct') ? '' : self.proxy_url,
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

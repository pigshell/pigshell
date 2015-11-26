/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var URI = {
    uri_parsers: {'unknown': GenericURI},

    register_uri_parser: function(scheme, parser) {
        this.uri_parsers[scheme] = parser;
    },

    unregister_uri_parser: function(scheme) {
        delete this.uri_parsers[scheme];
    },

    parse: function(uri) {
        var x = uri.match(/^([a-z][a-z0-9]*):[^ ]/),
            scheme = x ? x[1]: 'unknown',
            parser = this.uri_parsers[scheme] || this.uri_parsers['unknown'];

        return new parser(uri);
    }
};

function GenericURI(uri) {
    var x = uri.match(/^([a-z]+):[^ ]/),
        scheme = x ? x[1]: '';

    function parseUri(str) {
        var parser = /^(?:\/\/((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?(((\/?(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
            parserKeys = ["source", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "fragment"],
            m = parser.exec(str || ''),
            parts = {};

        parserKeys.forEach(function(key, i) {
            parts[key] = m[i] || '';
        });
        return parts;
    }

    if (scheme) {
        /* Unknown URI scheme */
        var fragment = (uri.indexOf('#') > -1) ? uri.slice(uri.indexOf('#') + 1) : '';
        this.parts = {"source": uri, "scheme": scheme, "fragment": fragment};
    } else {
        /* No scheme - assume it's a relative HTTP URL */
        this.parts = parseUri(uri);
    }
}

GenericURI.prototype.toString = function() {
    var u = this.parts,
        str = '';

    if (u.scheme) {
        str += u.scheme + ':';
    }
    if (u.authority) {
        str += '//' + u.authority;
    }
    if (u.path) {
        str += u.path;
    } else {
        if (u.host && (u.query || u.fragment)) {
            str += '/';
        }
    } 
    if (u.query) {
        str += '?' + u.query;
    }
    if (u.fragment) {
        str += '#' + u.fragment;
    }

    return str;
};

["scheme", "fragment", "path", "query"].forEach(function(el) {
    GenericURI.prototype[el] = function(val) {
        if (arguments.length) {
            this.parts[el] = val;
         }
         return this.parts[el];
    };

    GenericURI.prototype["set" + el[0].toUpperCase() + el.slice(1)] = function(val) {
        this.parts[el] = val;
        return this;
    };
});

["host", "port", "authority"].forEach(function(el) {
    GenericURI.prototype[el] = function() {
         return this.parts[el];
    };
});

GenericURI.prototype.isAbsolute = function() {
    return !!this.parts.scheme;
};

GenericURI.prototype.clone = function() {
    return URI.parse(this.toString());
};

function HttpURI(uri) {
    var x = uri.indexOf(':'),
        scheme = (x > 0) ? uri.substring(0, x) : '';

/* parseUri, MIT license
 * http://blog.stevenlevithan.com/archives/parseuri
 * Copyright 2007, Steven Levithan
 */

    function parseUri(str) {
        var parser = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
            parserKeys = ["source", "scheme", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "fragment"],
            m = parser.exec(str || ''),
            parts = {};

        parserKeys.forEach(function(key, i) {
            parts[key] = m[i] || '';
        });
        return parts;
    }

    this.parts = parseUri(uri);
}

inherit(HttpURI, GenericURI);

HttpURI.prototype.toString = function() {
    return this._assemble(this.parts);
};

HttpURI.prototype._assemble = function(u) {
    var str = u.scheme + '://' + u.authority;

    if (u.path) {
        str += u.path;
    } else {
        if (u.host && (u.query || u.fragment)) {
            str += '/';
        }
    } 
    if (u.query) {
        str += '?' + u.query;
    }
    if (u.fragment) {
        str += '#' + u.fragment;
    }

    return str;
};

HttpURI.prototype._normalizePath = function(path) {
    var comps = path.split('/'),
        out = [],
        npath;

    for (var i = 0, max = comps.length; i < max; i++) {
        var comp = comps[i];
        if (comp === '..') {
            out.pop();
        } else if (comp && comp !== '.') {
            out.push(comp);
        }
        /* comp == '.', comp == '' are ignored here */
    }
    npath = out.join('/');
    if (path[0] === '/') {
        npath = '/' + npath;
    }
    if (path[path.length - 1] === '/' && npath.length > 1) {
        npath += '/';
    }
    return npath;
};

HttpURI.prototype._normalizePath2 = function(path) {
    var pathParts, pathPart, pathStack, normalizedPath, i, len;

    if (path.indexOf('../') > -1) {

        pathParts = path.split('/');
        pathStack = [];

        for ( i = 0, len = pathParts.length; i < len; i++ ) {
            pathPart = pathParts[i];
            if (pathPart === '..') {
                pathStack.pop();
            } else if (pathPart) {
                pathStack.push(pathPart);
            }
        }

        normalizedPath = pathStack.join('/');

        // prepend slash if needed
        if (path[0] === '/') {
            normalizedPath = '/' + normalizedPath;
        }

        // append slash if needed
        if (path[path.length - 1] === '/' && normalizedPath.length > 1) {
            normalizedPath += '/';
        }

    } else {
        normalizedPath = path;
    }

    return normalizedPath;
};

HttpURI.prototype.resolve = function(ref) {
    ref = (ref instanceof GenericURI) ? ref : URI.parse(ref);

    var r = {};

    if (ref.scheme()) {
        return ref.toString();
    }
    if (ref.authority()) {
        ref.scheme(this.scheme());
        return ref.toString();
    }
    if (!ref.path()) {
        r.path = this.path();
        r.query = ref.query() || this.query();
    } else {
        if (ref.path().indexOf('/') === 0) {
            r.path = this._normalizePath(ref.path());
        } else {
            var path = this.path();
            r.path = path ? path.substring(0, path.lastIndexOf('/') + 1) : '/';
            r.path += ref.path();
            r.path = this._normalizePath(r.path);
        }
        r.query = ref.query();
    }
    r.authority = this.authority();
    r.scheme = this.scheme();
    r.fragment = ref.fragment();
    return this._assemble(r);
};

HttpURI.prototype.clone = function() {
    return new HttpURI(this.toString());
};

URI.register_uri_parser('http', HttpURI);
URI.register_uri_parser('https', HttpURI);
URI.register_uri_parser('file', HttpURI);

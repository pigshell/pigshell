/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * You can't write two lines of Javascript without making your own framework
 */

function isstring(obj) {
    return obj instanceof String || typeof obj === 'string';
}

function isnumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function isint(n) {
    return !!n.match(/^[0-9]+$/);
}

function iscmd(c) {
    return c instanceof Command || (c instanceof Array && c[0] instanceof Command);
}

function tohtml(str) {
    if (isstring(str)) {
        return str.replace(
            /&(?!#[0-9]+;|[a-zA-Z]+;)/g, '&amp;').replace(
            /</g, '&lt;').replace(/>/g, '&gt;');
    } else {
        return 'notastring';
    }
}

/*
 * Set up inheritance between subclass and base. Fairly straightforward now,
 * but can be tweaked later if need be without having to refactor all over
 * the place.
 */
function inherit(sub, base) {
    sub.prototype = Object.create(base.prototype);
    sub.prototype.constructor = sub;
    sub.base = base;
}

/*
 * Prototypal inheritance a la Crockford
 * http://javascript.crockford.com/prototypal.html
 * Returns new object which inherits from o
 */

function pinherit(o) {
    function F() {}
    F.prototype = o;
    return new F();
}

/*
 * Extend a with properties and methods of b, but retain a's constructor.
 */

function mixin(a, b) {
    var c = a.constructor,
        ab = $.extend(a, b);
    ab.constructor = c;
    return ab;
}

/*
 * Copy the attributes specified in `attrlist` from `b` to `a`
 */

function mergeattr(a, b, attrlist) {
    attrlist.forEach(function(attr) {
        if (b[attr] !== undefined) {
            a[attr] = b[attr];
        }
    });
    return a;
}

/*
 * Copy all attributes from `b` to `a` other than those specified in `attrlist`
 */

function mergeattr_x(a, b, attrlist) {
    for (var x in b) {
        if (b.hasOwnProperty(x) && attrlist.indexOf(x) === -1) {
            a[x] = b[x];
        }
    }
    return a;
}

function fstack_top(f) {
    while (f && f._ufile) {
        f = f._ufile;
    }
    return f;
}

function fstack_base(f) {
    while (f && f._lfile) {
        f = f._lfile;
    }
    return f;
}

function fstack_mylevel(f) {
    var base = fstack_base(f),
        level = 0;
    while (base) {
        if (base === f) {
            return level;
        }
        level++;
        base = base._ufile;
    }
    return -1;
}

function fstack_level(f, level) {
    var base = fstack_base(f);

    while (base && level--) {
        base = base._ufile;
    }
    return base;
}

function fstack_addtop(lower, upper) {
    lower._ufile = upper;
    upper._lfile = lower;
}

function fstack_rmtop(lower) {
    if (lower._ufile) {
        lower._ufile._lfile = undefined;
        lower._ufile = undefined;
    }
}

function fstack_rmbot(upper) {
    if (upper._lfile) {
        upper._lfile._ufile = undefined;
        upper._lfile = undefined;
    }
}

function fstack_passthrough(op) {
    return function() {
        return this._lfile ? this._lfile[op].apply(this._lfile, arguments) :
            this.enosys.apply(this, arguments);
    };
}

function fstack_invaldir_wrap(op) {
    return function() {
        var self = this,
            args = [].slice.call(arguments),
            callback = args.pop();

        function invaldir() {
            self.populated = false;
            return callback.apply(null, arguments);
        }
        args.push(invaldir);
        return self._lfile ? self._lfile[op].apply(self._lfile, args) :
            self.enosys.apply(self, args);
    };
}

function fstack_topfiles(files) {
    var tfiles = {};

    for (var f in files) {
        tfiles[f] = fstack_top(files[f]);
    }
    return tfiles;
}

function fstack_invaldir(file) {
    var f = fstack_base(file);

    while (f) {
        if (f.populated !== undefined) {
            f.populated = false;
        }
        f = f._ufile;
    }
}

/*
 * Compose two functions which follow the convention:
 * - last argument is a callback
 * - first argument of callback is an error
 */

function compose(f1, f2) {
    var self = this;
    function func() {
        var args = [].slice.call(arguments),
            callback = args.pop();
        
        function f1cb(err) {
            if (err) {
                return callback.apply(self, arguments);
            }
            var args = [].slice.call(arguments),
                f2args = args.slice(1);
            f2args.push(callback);
            f2.apply(self, f2args);
        }
        args.push(f1cb);
        f1.apply(self, args);
    }
    return func;
}

function err_stringify(err, str, usage) {
    if (isstring(err)) {
        return err;
    } else if (err.msg !== undefined) {
        var cmdname = usage ? usage.split(' ')[0] : '';
        if (str) {
            return cmdname + ': ' + err.msg + ': ' + str;
        }
        return err.msg;
    }
    return JSON.stringify(err);
}

function cloneCanvas(canvas, maxwidth) {
    var newCanvas = document.createElement('canvas'),
        mw = maxwidth || canvas.width;
    if (mw < canvas.width) {
        var zoom = canvas.width / mw;
        newCanvas.width = canvas.width / zoom;
        newCanvas.height = canvas.height / zoom;
    } else {
        newCanvas.width = canvas.width;
        newCanvas.height = canvas.height;
    }
    var context = newCanvas.getContext('2d');
    context.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newCanvas.width, newCanvas.height);
    return newCanvas;
}

/*
 * Split path into directory name and file name. Similar semantics as
 * python's os.path.split. pathjoin should always be able to reconstruct the
 * same location given components produced by pathsplit.
 * '' -> ['', '']
 * '/' -> ['/', '']
 * '.' -> ['', '.']
 * '..' -> ['', '..']
 * 'foo' -> ['', 'foo']
 * '//foo//bar/baz' -> ['/foo/bar', 'baz']
 * '/foo/bar/' -> ['/foo/bar', '']
 */

function pathsplit(path) {
    var comps = pathnorm(path).split('/');

    if (comps[0] === '' && comps.length === 1) {
        return ['', ''];
    }
    var file = comps.pop();
    if (comps.length === 0) {
        return ['', file];
    }
    if (comps[0] === '') {
        comps[0] = '/';
    }
    return [pathjoin(comps), file];
}

/*
 * Combine multiple path fragments into a normalized path. Similar to python's
 * os.path.join
 * (with the exception that non-first arguments beginning with a / do not kill
 * everything upto that point)
 * '', '', '' -> ''
 * '', 'foo' -> 'foo'
 * '/', '//foo//bar//baz/' -> '/foo/bar/baz/'
 */

function pathjoin() {
    var comps = (arguments[0] instanceof Array) ? arguments[0] : [].slice.call(arguments);

    comps = comps.filter(function(c) { return c !== ''; });
    return pathnorm(comps.join('/'));
}

function dirname(path) {
    return pathsplit(path)[0];
}

function basename(path) {
    return pathsplit(path)[1];
}

/*
 * Last component of path, even if it is a directory
 * '' -> '/'
 * '/' -> '/'
 * '/////' -> '/'
 * '/foo/bar/' -> 'bar'
 * '/foo/bar' -> 'bar'
 */

function basenamedir(path) {
    var comps = path.split('/');
    comps = comps.filter(function(c) { return c !== ''; });
    if (comps.length === 0 || (comps.length === 1 && comps[0] === '')) {
        return '/';
    } else {
        return comps[comps.length - 1];
    }
}

/* Normalize path by removing extra slashes */
function pathnorm(path) {
    return path.replace(/\/{2,}/g, '\/');
}

function hasWildCard(string) {
    return string.match(/[\\?\\*]/);
}

function getMimeFromExtension(filename) {
    var ext = filename.split(".").pop();
    if (ext && ext.length > 0) {
        return mimeMap[ext.toLowerCase()];
    } else {
        return null;
    }
}

var global_id = 1;

function E(code) {
    var msg = Errno[code] || 'Unknown error';
    return {'code': code, 'msg': msg};
}

var Errno = {
    'EPERM':    'Operation not permitted',
    'ENOENT':   'No such file or directory',
    'EIO':      'Input/output error',
    'ENXIO':    'Device not configured',
    'ENOEXEC':  'Exec format error',
    'EACCES':   'Permission denied',
    'EEXIST':   'File exists',
    'ENODEV':   'Operation not supported by device',
    'ENOTDIR':  'Not a directory',
    'EISDIR':   'Is a directory',
    'EINVAL':   'Invalid argument',
    'ENOSPC':   'No space left',
    'EROFS':    'Read-only file system',
    'ENOSYS':   'Operation not implemented',
    'ENAMETOOLONG': 'File name too long',
    'ETIMEDOUT': 'Operation timed out',
    'ENOTEMPTY': 'Directory not empty',
    'EINVALFILE' : 'Invalid file type',
    'ENODATA' : 'No data',
    'ENOURL' : 'No URL for file',
    'EPROTONOSUPPORT' : 'Protocol not supported',
    'EXDEV': 'Cross-device link',
    'EPIPE': 'Broken pipe',
    'ESTACKMOD': 'File stack modified'
};

function cloneContent(content) {
    if (content.constructor && content.constructor === Blob) {
        return content.slice(0, content.size, content.type);
    } else if (content.data) {
        if (isstring(content.data)) {
            return content.data;
        } else if (content.data.constructor === HTMLCanvasElement) {
            return cloneCanvas(content.data);
        } else { // treat as blob
            return content.data.slice(0, content.data.size, content.data.type);
        }
    }
}

/*
 * ls-style date formatting. If the date is within the current year, then
 * return something like May 10 10:07, else Sep 19  2011. Length of string
 * should be exactly 12.
 */

function lsdate(d) {
    var year = d.getFullYear(),
        month = d.getMonth(),
        date = d.getDate(),
        hours = d.getHours(),
        mins = d.getMinutes(),
        thisyear = new Date().getFullYear(),
        out;

    if (thisyear === year) {
        out = sprintf('%3s %2d %02d:%02d', getMonthName(month), date, hours, mins);
    } else {
        out = sprintf('%3s %2d  %4d', getMonthName(month), date, year);
    }
    return out;
}

/*
 * return list of lists of max size = length
 */
function getGroups(list, length) {
    if (length === 0) {
        return list;
    }
    var total = Math.floor(list.length/length),
        returnList = [];
    for (var i = 0; i < total; i++) {
        returnList.push(list.slice(i*length, (i+1)*length));
    }
    var lastList = list.slice(total*length, list.length);
    if (lastList.length > 0) {
        returnList.push(lastList);
    }
    return returnList;
}

function urlize(text) {
    var exp = /(\b(https?|ftp|file):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a target='_blank' href='$1'>$1</a>"); 
}

function fb_urlize(text) {
//    var exp = /\b@\[([0-9]+):[0-9]+:(.*)\]/ig;
//    return urlize(text).replace(exp,"<a target='_blank' href='https://www.facebook.com/$1'>$2</a>"); 
    return urlize(text);
}

function fb_tag_story(post) {
    if (post.story === 'undefined') {
        return undefined;
    }
    if (!(post.story_tags)) {
        return post.story;
    }
    
    var result = post.story;
    
    var tags = Object.keys(post.story_tags);
    tags.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });
    tags.reverse();

    for (var i = 0; i < tags.length; i++) {
        var tag_val = post.story_tags[tags[i]][0];
        result = result.substring(0, tag_val.offset) + 
            "<a target='_blank' title='" + tag_val.name +
            "' href='https://www.facebook.com/" + tag_val.id +
            "'>" + tag_val.name + "</a>" +
            result.substring(tag_val.offset + tag_val.length);
    }
    
    return result;
}

function twitter_time(dateString) {
    return fb_time(dateString);
}

function fb_time(dateString) {
    var a = moment();
    var b = moment(dateString);
    return b.from(a);
}

function getMonthName(month) {
    var m_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
        'Oct', 'Nov', 'Dec'];
    return m_names[month];
}

function eval_getexp(exp) {
    var ret;
    try {
        var fstr = '"use strict"; var getfield = function(x, self) { return (' + exp + ');};getfield;';
        ret = eval(fstr);
    } catch(err) {
        ret = 'Eval error: ' + err.message;
    }
    return ret;
}

function eval_getfield(field, dfl) {
    var ret,
        fields = field.split('.');

    if (isstring(dfl)) {
        dfl = '"' + dfl + '"';
    } else if (dfl === undefined) {
        dfl = 'undefined';
    } else if (dfl === null) {
        dfl = 'null';
    } else if (dfl === true) {
        dfl = 'true';
    } else if (dfl === false) {
        dfl = 'false';
    }
    try {
        var fstr = '"use strict"; var getfield = function(x) { var y = x; ';
        for (var i = 0; i < fields.length; i++) {
            fstr += 'y = y["' + fields[i] + '"]; if (y === undefined) { return ' + dfl + ';};';
        }
        fstr += 'return y;};getfield;';
        ret = eval(fstr);
    } catch(err) {
        ret = 'Eval error: ' + err.message;
    }
    return ret;
}

function linkify_entities(tweet) {
    if (!(tweet.entities)) {
        return tweet.text;
    }
    
    // This is very naive, should find a better way to parse this
    var index_map = {};
    
    $.each(tweet.entities.urls, function(i,entry) {
        index_map[entry.indices[0]] = [entry.indices[1], function(text) {
            return "<a target='_blank' href='" + entry.expanded_url +
                "'>" + entry.display_url + "</a>";
        }];
    });
    
    $.each(tweet.entities.hashtags, function(i,entry) {
        index_map[entry.indices[0]] = [entry.indices[1], function(text) {
            return "<a target='_blank' href='https://twitter.com/search?q=" +
                escape("#" + entry.text) + "'>" + text + "</a>";
        }];
    });
    
    $.each(tweet.entities.user_mentions, function(i,entry) {
        index_map[entry.indices[0]] = [entry.indices[1], function(text) {
            return "<a target='_blank' title='" + entry.name +
                "' href='https://twitter.com/" + entry.screen_name +
                "'>" + text + "</a>";
        }];
    });
    
    var result = "",
        last_i = 0,
        i = 0;
    
    // iterate through the string looking for matches in the index_map
    for (var i = 0; i < tweet.text.length; ++i) {
        var ind = index_map[i];
        if (ind) {
            var end = ind[0];
            var func = ind[1];
            if (i > last_i) {
                result += tweet.text.substring(last_i, i);
            }
            result += func(tweet.text.substring(i, end));
            i = end - 1;
            last_i = end;
        }
    }
    
    if (i > last_i) {
        result += tweet.text.substring(last_i, i);
    }
    
    return result;
}

function compareStringAsUInt(first, second) {
    // ensure both are strings
    first = first.toString();
    second = second.toString();

    // longer string is a bigger number regardless of lexical compare
    if (first.length !== second.length) {
        return (first.length - second.length);
    }
    return first.localeCompare(second);
}

function createPrefix(one, two, isArray) {
    if (one.length === 0) {
        return two;
    }
    if (isArray) {
        return one + "[" + two + "]";
    }
    return one + "." + two;
}

function prettyPrint(obj, tty, prefix) {
    var returnString = "";
    var parentField = prefix || "";
    var fieldContents;
    var keys = [];
    for (var field in obj) {
        if (obj.hasOwnProperty(field)) {
            keys.push(field);
        }
    }
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
        var field = keys[i];
        fieldContents = obj[field];
        if (typeof(fieldContents) === "object" && fieldContents !== null) {
            returnString +=
                prettyPrint(fieldContents, tty,
                    createPrefix(parentField, field, obj.constructor === Array));
        } else if (typeof(fieldContents) !== "function") {
            returnString +=
                (tty ? '<span class="field">' : '') +
                createPrefix(parentField, field, obj.constructor === Array) +
                (tty ? '</span>' : ' : ') +
                (fieldContents === undefined || fieldContents === null ? fieldContents :
                    ((field === 'html' || !tty) ? fieldContents : urlize(fieldContents.toString()))) +
                    (tty ? "<br>" : "\n");
        }
    }
    return returnString;
}

/*
 * Clear out fields which have the potential for infinite recursion. Used
 * in printf and stat
 */

function cleanFile(file) {
    delete file.fs;
    delete file.files;
    delete file._lfile;
    delete file._ufile;
    if (file.data && file.data.data instanceof HTMLCanvasElement) {
        delete file.data.data;
    }
}

function bucket(data, numBuckets) {
    if (data.length <= numBuckets) {
        return data;
    }

    var min = parseFloat(data[0][0], 10),
        max = parseFloat(data[data.length - 1][0], 10),
        inc = (max - min) / numBuckets,
        returnData = [];
    for (var i = 0; i < numBuckets; i++) {
        var limit = min + ((i + 1) * inc);
        var value = 0;
        for (var j = data.length - 1; j >= 0; j--) {
            if (parseFloat(data[j][0], 10) <= limit) {
                value += data[j][1];
                data.splice(j, 1);
            }
        }
        returnData.push([limit, value]);
    }
    return returnData;
}

function beautify(str) {
    if (!str) return str;
    var arr = str.split(/\s|_/);
    for(var i=0,l=arr.length; i<l; i++) {
        arr[i] = arr[i].substr(0,1).toUpperCase() + 
                 (arr[i].length > 1 ? arr[i].substr(1).toLowerCase() : "");
    }
    return arr.join(" ");
}

function parse_error(cmd, e) {
    var lines = cmd.split('\n');
    var res = 'Parse error in line:' + e.line + ' col:' + e.column + ' "' +
        lines[e.line - 1] + '"' + '\n' + e.message;
    return res;
}

/* Return a new array with unique names */
function uniq(names) {
    var u = [];

    for (var i = 0; i < names.length; i++) {
        if (u.indexOf(names[i]) === -1) {
            u.push(names[i]);
        }
    }
    return u.sort();
}

function urisplit(uri) {
    return uri.match(/^([a-zA-Z0-9+\-\.]+):(.*)/);
}

/*
 * Parse option string. These may occur in various places: as hash fragments,
 * arguments to the -o option in commands, and programatically.
 *
 * If the URI-decoded string begins with '{', it is assumed to be a JSON
 * string and is decoded accordingly.
 *
 * If not, option strings are in the form of comma-separated key=value pairs.
 * Keys may be namespaced using a dotted module.key notation.
 * e.g. key1=value1,fs1.key1=value2,key3,key1=value3 would produce an object
 * { key1: [value1, value3], fs1: { key1: value2 }, key3: true }
 */

function optstr_parse(str, parsenum) {
    if (!isstring(str)) {
        return {};
    }
    var dstr = '',
        opts = {};

    try {
        dstr = decodeURIComponent(str).trim();
    } catch (e) {
        /* Wayward % characters in an unencoded string can cause exceptions */
        dstr = str.trim();
    }
    if (dstr[0] === '{') {
        var o = null;
        try { o = JSON.parse(dstr); } catch (e) {}
        return o || {};
    }
    function set_opt(key, value) {
        var cur = opts,
            comps = key.split('.'),
            last = comps.pop();

        if (value !== '' && parsenum && !isNaN(+value)) {
            value = +value;
        }
        for (var i = 0; i < comps.length; i++) {
            var comp = comps[i];
            if (cur[comp] === undefined) {
                cur[comp] = {};
            }
            cur = cur[comp];
        }
        if (cur[last]) {
            if (cur[last] instanceof Array) {
                cur[last].push(value);
            } else {
                cur[last] = [cur[last], value];
            }
        } else {
            cur[last] = value;
        }
    }
    var optlist = dstr ? dstr.split(',') : [];
    for (var i = 0; i < optlist.length; i++) {
        var opt = optlist[i],
            eqlist = opt.split('=');
        if (eqlist.length > 1) {
            set_opt(eqlist[0], eqlist.slice(1).join('='));
        } else {
            set_opt(eqlist[0], true);
        }
    }
    return opts;
}

/*
 * Strict encoding of URI component
 */

function enc_uri(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

function dec_uri(str) {
    var ret;
    try {
        ret = decodeURIComponent(str);
    } catch (e) {
        ret = str;
    }
    return ret;
}

function xhr_getmime(headers) {
    var rt = headers["content-type"] || '';
    rt = rt.split(';')[0];
    return rt;
}

function header_dict(xhr)
{
    var str = xhr.getAllResponseHeaders() || '',
        status = xhr.status,
        headers = str.split('\n'),
        dict = {};

    headers.forEach(function(h) {
        var m = h.match(/^([^:]+):\s+(.*)/);
        if (m) {
            dict[m[1].toLowerCase()] = m[2];
        }
    });
    dict['status'] = status;
    return dict;
}

function isdir(file) {
    return (file.mime === 'directory' || file.readdir !== undefined);
}

function isrealdir(file) {
    return ((file.mime === 'directory' || file.readdir !== undefined) &&
        !file._nodescend);
}

/*
 * To be used by commands for processing a large file chunk by chunk
 * using a worker function. This is good for streaming operations like
 * copy, checksum etc. which don't need the file all at once in memory.
 */
function fproc(file, opts, worker, cb) {
    var self = this,
        chunksize = opts.chunksize || 1024 * 1024,
        irange = opts.range || {off: 0, len: -1},
        drange = {off: irange.off, len: 0};

    /* Some files don't get a valid file until statted */
    if (typeof file.stat === 'function') {
        sys.stat(self, file, {}, ef(cb, function() {
            fp2();
        }));
    } else {
        fp2();
    }

    function fp2() {
        if (irange.len === -1) {
            irange.len = file.size - irange.off;
        }
        if (irange.off < 0 || irange.off > file.size ||
            irange.off + irange.len > file.size) {
            return cb(E('EINVAL'));
        }
        /*
         * Some files have 0-len due to incomplete FS, but have data. Should 
         * be read *once*.
         *
         * Files managed by Google Docs (not Drive) have 0 size. 
         */
        var off = irange.off,
            oneshot = (file.size === 0) ? 1 : 0,
            left = oneshot ? 0 : irange.len;

        async.whilst(function() { return oneshot || left > 0; },
            function(acb) {
                var rlen = (left < chunksize) ? left : chunksize,
                    opts = oneshot ? {} : {range: {off: off, len: rlen}};

                if (self.done !== undefined) {
                    return cb('killed');
                }
                sys.read(self, file, opts,
                    ef(cb, function(res, range) {
                        if (self.done !== undefined) {
                            return cb('killed');
                        }
                        if (range) {
                            if (range.off === -1) {
                                /*
                                 * Google Drive happily gives partial content
                                 * but doesn't expose Content-Range via OPTIONS.
                                 * Fly by instruments, hope for the best.
                                 */
                                range.off = off;
                            } else if (range.off !== off) {
                                return cb(E('EIO'));
                            }
                        } else { /* temp hack for old filesystems */
                            range = {off: 0};
                            if (res instanceof Blob) {
                                range.len = res.size;
                            } else if (isstring(res)) {
                                range.len = res.length;
                            } else {
                                range.len = file.size;
                            }
                            range.size = file.size;
                        }
                        worker(res, range, ef(cb, function() {
                            off += range.len;
                            left -= range.len;
                            drange.len += range.len;
                            oneshot = false;
                            return soguard(self, acb.bind(this, null));
                        }));
                }));
            },
            function() {
                return cb(null, null, { range: drange });
            }
        );
    }
}

/*
 * Restore a "compound file" into a bundle.
 *
 * Must be called with 'this' set to a directory into which the bundle is to
 * be restored. This directory presumably belongs to a generic-container
 * filesystem like pstyfs (unlike special-container filesystems like picasa)
 *
 * First argument contains a tree of file-like objects to be restored to the
 * current directory.
 * obj={  'foo.bdl': {
 *          '.meta': '{"mime": "text/html"...}',
 *          'foo.html': HttpFile(..),
 *          '.rsrc': {
 *            'foo1.css': HttpFile(..),
 *            'foo2.css': HttpFile(..),
 *            'foo3.js': HttpFile(..)
 *          }
 *        }
 *      }
 */

function restoretree(obj, opts, cb) {
    var self = this,
        context = opts.context,
        fnamelist = Object.keys(obj);

    function streamcp(tname, sfile, cb) {
        self.lookup(tname, opts, function(err, res) {
            if (!err && opts['resume']) {
                return cp3(res);
            }
            self.putdir(tname, [''], opts, ef(cb, function() {
                self.lookup(tname, opts, ef(cb, cp3));
            }));
        });

        function cp3(tfile) {
            var opts3 = $.extend({}, opts),
                basefile = fstack_base(tfile);
                
            if (opts['resume']) {
                if (sfile.size > 0) {
                    opts3.range = {off: basefile.size, len: -1};
                } else if (sfile.mtime <= tfile.mtime) {
                    return cb(null, null, {status: 'skipped', more: 'mtime check'});
                }
            }
            fproc.call(context, sfile, opts, function(res, range, acb) {
                basefile.append(res, opts, ef(cb, acb));
            }, cb);
        }
    }

    async.forEachSeries(fnamelist, function(fname, acb) {
        var data = obj[fname];

        if (data instanceof File) {
            streamcp(fname, data, acb);
        } else if (isstring(data)) {
            self.lookup(fname, opts, function(err, res) {
                if (!err && opts['resume']) {
                    var basefile = fstack_base(res);
                    return basefile.append(data.slice(basefile.size), opts, ef(cb, acb));
                } else {
                    return self.putdir(fname, [data], opts, ef(cb, acb));
                }
            });
        } else {
            try {
                var k = Object.keys(data);
            } catch (e) {
                return acb("Invalid object " + fname);
            }
            self.mkdir(fname, opts, function(err, dir) {
                if (!err || err.code === 'EEXIST') {
                    self.lookup(fname, opts, ef(acb, function(dir) {
                        var pd = fstack_base(dir);
                        while (pd && pd.mime !== self.fs.dirmime) {
                            pd = pd._ufile;
                        }
                        restoretree.call(pd, data, opts, acb);
                    }));
                } else {
                    return acb(err);
                }
            });
        }
    }, function(err) {
        return cb(err);
    });
}

function rmtree(file, opts, cb)
{
    var self = this;

    if (!isrealdir(file)) {
        return cb(null, null);
    }

    file.readdir(opts, ef(cb, function(files) {
        var fnames = Object.keys(files);
        async.forEachSeries(fnames, function(fname, acb) {
            var f = files[fname];
            if (isrealdir(f)) {
                rmtree(f, opts, function(err) {
                    if (!err) {
                        file.rm(fname, opts, function() {
                            return acb(null);
                        });
                    } else {
                        return acb(null);
                    }
                });
            } else {
                file.rm(fname, opts, function() {
                    return acb(null);
                });
            }
        }, function(err) {
            return cb(err);
        });
    }));
}

/*
 * Decorators - wrap 'next' methods of commands. Note: do not use self = this
 * AT THE TOP LEVEL; you absolutely don't want a closure here, otherwise you'd
 * wind up with a cached value of 'window' as self. You can use it inside the
 * function you're returning - see check_live().
 */

/*
 * Decorator to ensure that command is alive and enclosing shell is not
 * suspended. If the command is dead, emit an EOF.
 */

function check_live(f) {
    return function() {
        var self = this,
            args = [].slice.call(arguments),
            callback = args[args.length - 1],
            shell = self instanceof Shell ? self : self.shell;

        if (self === window) {
            console.log("check_live self window");
        }
        if (shell && shell.status === 'done') {
            return self.eof();
        }
        if (!shell || shell.status === 'start') {
            if (self.done !== undefined) {
                return self.eof();
            }
            proc.current(self);
            return f.apply(self, args);
        }
        var cb = function() {
            if (shell.status === 'start') {
                shell._status_change.remove(cb);
                if (self.done !== undefined) {
                    return self.eof();
                }
                proc.current(self);
                return f.apply(self, args);
            }
        };
        shell._status_change.add(cb);
    };
}

/*
 * Used only with next() methods of commands. Like check_live, but in addition,
 * captures the callback to which the next() should return data. This is used
 * by output(), eof() etc.
 */

function check_next(f) {
    return function() {
        var self = this,
            args = [].slice.call(arguments),
            callback = args[args.length - 1],
            shell = self instanceof Shell ? self : self.shell;

        if (self === window) {
            console.log("check_next self window");
        }
        if (self._nextcb) {
            pdebug(self, "_nextcb already set!");
        }
        self._nextcb = callback;
        if (shell && shell.status === 'done') {
            return self._output(null);
        }
        if (!shell || shell.status === 'start') {
            if (self._obuffer.length) {
                return self._output(self._obuffer.shift());
            }
            if (self.done !== undefined) {
                return self._output(null);
            }
            proc.current(self);
            return f.apply(self, args);
        }
        var cb = function() {
            if (shell.status === 'start') {
                shell._status_change.remove(cb);
                if (self._obuffer.length) {
                    return self._output(self._obuffer.shift());
                }
                if (self.done !== undefined) {
                    return self._output(null);
                }
                proc.current(self);
                return f.apply(self, args);
            }
        };
        shell._status_change.add(cb);
    };
}

/*
 * Commands which process either a list of files supplied in the arguments
 * or stdin should use this decorator.
 */

function fileargs(next) {
    return function() {
        var self = this,
            args = [].slice.call(arguments),
            filenames = self.docopts['<file>'];
        if (filenames && filenames.length) {
            var opts = {};
            self.docopts['<file>'] = null;
            var opts = self.docopts['-o'] ? optstr_parse(self.docopts['-o'],
                true) : {};
                
            lookup_files.call(self, opts, filenames, function(entries) {
                var files = $.map(entries, function(e) { return e.file; });
                files.push(null);
                self._buffer = self._buffer.concat(files);
                return next.apply(self, args);
            });
        } else {
            return next.apply(self, args);
        }
    };
}

/*
 * Commands which process either a list of objects supplied in the arguments
 * or stdin should use this decorator.
 */

function objargs(next) {
    return function() {
        var self = this,
            objects = self.docopts['<obj>'];
        if (objects && objects.length) {
            self.docopts['<obj>'] = null;
            objects.push(null);
            self._buffer = self._buffer.concat(objects);
            return next.apply(self, arguments);
        } else {
            return next.apply(self, arguments);
        }
    };
}



/* Decorator to call docopt processing first time round */

function do_docopt(next) {
    return function() {
        if (this.usage && this.docopts === undefined) {
            var res = docopt(this.internalUsage || this.usage,
                {'argv': this.opts.argv.slice(1)},
                this.usage);
            if (res[0] !== null) {
                this.errmsg(res[0]);
                this.done = true;
                return this.eof();
            }
            this.docopts = res[1];
        }
        return next.apply(this, arguments);
    };
}

/*
 * Decorator to load scripts before running commands or media handlers.
 */
function loadscripts(next) {
    return function() {
        var self = this,
            args = [].slice.call(arguments),
            cb = (self instanceof Command) ? self.exit : args[args.length - 1],
            self2 = (self instanceof Command) ? self.constructor : self;
        if (self2.scripts && self2._scripts_loaded === undefined) {
            loadjs(self2.scripts, {}, function(err, res) {
                if (err) {
                    return cb.call(self, err);
                }
                self2._scripts_loaded = true;
                return next.apply(self, args);
            });
        } else {
            return next.apply(self, args);
        }
    };
}

/*
 * Decorator - wrap callbacks used inside commands. When commands call async
 * "upstream" methods and supply them with a callback, that callback needs to
 * check command state - if we have been killed, need to get out immediately,
 * etc. Capture all that boilerplate here.
 */

function wrap_cb(cmd, cb) {
    return function() {
        if (cmd.done !== undefined) {
            return cmd.eof();
        }
        return cb.apply(cmd, arguments);
    };
}

/*
 * Error filter decorator. With nested async functions, callbacks typically
 * bail to the outer callback on error. This decorator helps reduce some of
 * the visual garbage associated with callback hell, at the expense of stack.
 * some_async(..., cb) {
 *      another_async(..., function(err, res) {
 *          if (err) {
 *              return cb(err);
 *          }
 *          process_res(res);
 *      });
 * } 
 * becomes
 * some_async(..., cb) {
 *      another_async(..., ef(cb, function(res) {
 *          process_res(res);
 *      }));
 * }
 */

function ef(cb, f) {
    return function() {
        if (arguments[0]) {
            return cb.apply(this, arguments);
        }
        return f.apply(this, [].slice.call(arguments, 1));
    };
}

/*
 * Error filter used at output of unext() to process abort events.
 */

function cef(cmd, f) {
    return function() {
        if (arguments[0]) {
            return cmd.abort(arguments[0]);
        }
        return f.apply(cmd, [].slice.call(arguments, 1));
    };
}

/*
 * Error filter used in index.html et al to display errors in a div
 */
function hef(divspec, f) {
    return function() {
        if (arguments[0]) {
            if (divspec) {
                $(divspec).prepend("<p class='warning'>" + err_stringify(arguments[0]) + "</p>");
            } else {
                console.log(err_stringify(arguments[0]));
            }
        } else {
            return f.apply(this, [].slice.call(arguments, 1));
        }
    };
}

/*
 * Lookup a list of pathnames, supply cb with the list of entry objects
 * An entry object looks like {path: pathname, file: fileobject} 
 */

function lookup_files(opts, plist, cb) {
    var self = this,
        entries = [];

    if (!(self instanceof Command)) {
        var err = "lookup_files must be called in command context";
        console.log(err, self);
        return cb(err);
    }
    async.forEachSeries(plist, function(p, acb) {
        if (p instanceof File) {
            entries.push({path: p.name, file:p});
            return soguard(self, acb.bind(this, null));
        }
        if (!isstring(p)) {
            entries.push({path: null, file:p});
            return soguard(self, acb.bind(this, null));
        }
        if (!opts.query) {
            sys.lookup(self, p, opts, function(err, f) {
                if (err) {
                    self.retval = false;
                    self.errmsg(err, p);
                    return soguard(self, acb.bind(this, null));
                }
                entries.push({path: p, file: f});
                return soguard(self, acb.bind(this, null));
            });
        } else {
            var opts2 = $.extend({}, opts, {query: true});
            sys.search(self, p, opts2, function(err, f) {
                if (err) {
                    self.retval = false;
                    self.errmsg(err, p);
                    return soguard(self, acb.bind(this, null));
                }
                var comps = pathsplit(p),
                    last = comps[1],
                    pdir = comps[0];

                for (var i = 0; i < f.length; i++) {
                    entries.push({path: pathjoin(pdir, f[i][0]), file: f[i][1]});
                }
                return soguard(self, acb.bind(this, null));
            });
        }

    }, function(err) {
           return cb(entries);
    });
}
function loadjs(url, opts, cb) {
    var scriptlist = [],
        urllist = (url instanceof Array) ? url : [url],
        baseurl = '';
    $('script').each(function() {
        if (this.src) {
            scriptlist.push(this.src.toString());
        }
    });
    var baseuri = URI.parse(pigshell_baseurl);
    if (!baseuri.isAbsolute()) {
        baseuri = URI.parse(window.location.href);
    }
    baseuri.setFragment("");
    async.forEachSeries(urllist, function(u, acb) {
        var uri = URI.parse(u);
        if (!uri.isAbsolute()) {
            uri = baseuri.resolve(uri);
            u = uri.toString();
        }
        if (scriptlist.indexOf(u) !== -1) {
            if (!opts.force) {
                return acb(null);
            } else {
                $('script[src="' + u + '"]').remove();
            }
        }
        if (opts.nocache) {
            uri.setQuery(Date.now().toString());
            u = uri.toString();
        }
        script_add(u, ef(cb, acb.bind(this, null)));
    }, function(err) {
        return cb(err);
    });
}

/*
 * Decorator to capture and set the current command across an async event
 * handler.
 */

function setcur(f) {
    var current = proc.current();
    return function() {
        proc.current(current);
        f.apply(null, arguments);
    };
}

/*
 * Decorator to convert list of items to a blob. Used to wrap putdirs
 */

function mkblob(putdir) {
    return function(filename, clist, opts, cb) {
        var self = this,
            opts2 = {name: filename};
        if (opts.putdir && opts.putdir.mime) {
           opts2.mime = opts.putdir.mime;
        }
        to('blob', clist, opts2, ef(cb, function(res) {
            return putdir.call(self, filename, res, opts, cb);
        }));
    };
}

function ab_concat(a, b) {
    var c = new Uint8Array(a.byteLength + b.byteLength);
    c.set(new Uint8Array(a), 0);
    c.set(new Uint8Array(b), a.byteLength);
    return c.buffer;
}

function untar(file, dir, opts, cb) {
    var REGTYPE = "0",
        LNKTYPE = "1",
        SYMTYPE = "2",
        DIRTYPE = "5",
        context = opts.context;

    function get_string(buf) {
        var str = '';

        for (var i = 0, len = buf.byteLength; i < len && buf[i]; i++) {
            str += String.fromCharCode(buf[i]);
        }
        return str;
    }
    function parse_header(buf) {
        var header = {};

        if (buf[0] === 0) {
            /* Really need a stronger check; whole block must be zeros */
            return 'EOF';
        }
        header.magic = get_string(buf.subarray(257, 263));
        header.version = get_string(buf.subarray(263, 265));

        if (header.magic !== 'ustar' && header.version !== '00') {
            return null;
        }
        header.mode = get_string(buf.subarray(100, 108));
        header.uid = get_string(buf.subarray(108, 116));
        header.gid = get_string(buf.subarray(116, 124));
        header.size = parseInt(get_string(buf.subarray(124, 135)), 8);
        header.mtime = parseInt(get_string(buf.subarray(136, 148)), 8);
        header.typeflag = get_string(buf.subarray(156, 157));
        var name = get_string(buf.subarray(0, 100)),
            prefix = get_string(buf.subarray(345, 500));

        if (prefix) {
            name = prefix + '/' + name;
        }
        if (header.typeflag === DIRTYPE && name[name.length - 1] === '/') {
            name = name.slice(0, name.length - 1);
        }
        header.filename = name;

        return header;
    }

    function makedir(header, cb) {
        var name = header.filename;

        if (name === '.' || name === '/') {
            return cb(null);
        }
        mkdir.call(context, name, cb);
    }

    function makereg(header, buf, cb) {
        fwrite.call(context, header.filename, [buf], cb);
    }

    file.read({context: context}, ef(cb, function(res) {
        to('arraybuffer', res, {}, ef(cb, function(ab) {
            var offset = 0,
                len = ab.byteLength,
                buffer = new Uint8Array(ab);

            async.whilst(function() { return offset < len; }, function(acb) {
                var header = parse_header(buffer.subarray(offset));

                if (header === 'EOF') {
                    return cb(null, null);
                } else if (!header) {
                    return cb("Bad tar header at offset" + offset);
                }
                //console.log(sprintf("offset %d name %s type %s size %d", offset, header.filename, header.typeflag, header.size));

                function next() {
                    offset += 512 + Math.ceil(header.size / 512) * 512;
                    return soguard(context, acb.bind(null, null));
                }
                 
                if (header.typeflag === DIRTYPE) {
                    makedir(header, function(err, res) {
                        if (err) {
                            console.log(err);
                        }
                        return next();
                    });
                } else if (header.typeflag === REGTYPE) {
                    makereg(header, buffer.subarray(offset + 512,
                        offset + 512 + header.size),
                        function(err, res) {
                        if (err) {
                            console.log(err);
                        }
                        return next();
                    });
                } else {
                    //console.log("Skipping " + header.filename);
                    return next();
                }
            }, cb);
        }));
    }));
}

/*
 * Called in the context of a command
 */

function frename(srcname, dstname, cb) {
    var self = this,
        comps = pathsplit(srcname),
        sdirname = comps[0],
        sfilename = comps[1];

    function do_rename(srcfile, srcdir, dstdir, dfilename) {
        if (!srcdir.fs.rename) {
            return cb(E('ENOSYS'));
        }
        return srcdir.fs.rename(srcfile, srcdir, sfilename, dstdir, dfilename,
            { context: self }, cb);
    }

    function frename1(srcfile, dstdir, dname) {
        var sdn = sdirname || '.';
        fstat.call(self, sdn, ef(cb, function(srcdir) {
            if (srcdir.fs !== dstdir.fs) {
                return cb(E('EXDEV'));
            }
            return do_rename(srcfile, srcdir, dstdir, dname);
        }));
    }

    if (sfilename === '' || sfilename === '.' || sfilename === '..') {
        return cb(E('EINVAL'));
    }

    fstat.call(self, srcname, ef(cb, function(srcfile) {
        fstat.call(self, dstname, function(err, dstfile) {
            if (!err && isrealdir(srcfile) && !isrealdir(dstfile)) {
                /* Cannot move directory to existing regular file */
                return cb(E('ENOTDIR'));
            } else if (err || !isrealdir(dstfile)) {
                /* Destination doesn't exist, or is a regular file */
                var comps = pathsplit(dstname),
                    pdir = comps[0],
                    dname = comps[1];
                fstat.call(self, pdir, ef(cb, function(dstdir) {
                    return frename1(srcfile, dstdir, dname);
                }));
            } else {
                /* Destination exists, and is a directory */
                return frename1(srcfile, dstfile, sfilename);
            }
        });
    }));
}

/* Based on JQuery's loader */
function script_add(url, cb) {
    var script,
        head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;

    script = document.createElement("script");
    script.src = url;
    script.onload = script.onreadystatechange = script.onerror = function(e,
        isAbort) {
        proc.current(current);
        isAbort = isAbort || e.type === 'error';
        if (isAbort || !script.readyState ||
            /loaded|complete/.test(script.readyState)) {

            script.onload = script.onreadystatechange = null;
            if (isAbort && head && script.parentNode) {
                head.removeChild(script);
            }
            script = undefined;
            var ret = isAbort ? "Error loading script: " + url : null;
            return cb(ret, null);
        }
    };
    var current = proc.current(null);
    head.insertBefore(script, head.firstChild);
}

function mount_uri(uri, dir, mountopts, shell, cb) {
    var self = this;
    VFS.lookup_uri(uri, {'mountopts': mountopts},
        wrap_cb(self, ef(cb, function(res) {
        return shell.ns.mount(dir, res, mountopts, cb);
        })));
}

function run_cmd(cmd, divspec) {
    var sh = initshell.fork_interactive({}, $(divspec));
    if (!(cmd instanceof Array)) {
        cmd = [cmd];
    }
    cmd.forEach(function(c) {
        sh.cli.cli_input(c);
    });
}

/*
 * Horrible hack to avoid stack overflow. Every 50 soguarded function calls,
 * we do a setTimeout. We don't do this with every iteration because things
 * get too visibly slow.
 */

var _nstack_depth = 0, _nstack_max = 50;

function soguard(s, f) {
    _nstack_depth++;
    if (_nstack_depth % _nstack_max === 0) {
        return setTimeout(catcher.bind(s, f), 0);
    } else {
        return f();
    }
}

function catcher(f, args) {
    proc.current(this);
    return f.apply(this, args);
}

function check_soguard(f) {
    return function() {
        var self = this,
            args = arguments;
        _nstack_depth++;
        if (_nstack_depth % _nstack_max === 0) {
            return setTimeout(catcher.bind(self, f, args), 0);
        } else {
            return f.apply(self, args);
        }
    };
}

/*
 * Is our input or output a tty? Some commands may change their behaviour
 * depending whether stdin/stdout is a tty. e.g. ls.
 */
function isatty(fd) {
    return fd instanceof Pterm;
}

/* A JSON parser which returns null rather than throwing exceptions */
function parse_json(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

/*
 * Convert an object to a list, with the intention of normalizing, stringifying
 * and comparing two objects
 */
function obj2list(obj) {
    return Object.keys(obj).sort().map(function(e) {
        if (obj.hasOwnProperty(e)) {
            return [e, typeof obj[e] === 'object' ? obj2list(obj[e]) : obj[e]];
        }
        return [e, null];
    });
}

function zip_object(k, v) {
    var o = {};
    for (var i = 0, len = k.length; i < len; i++) {
        o[k[i]] = v[i];
    }
    return o;
}

/*
 * Some commands (rename, reshape) take arguments which may be either a
 * comma-separated string or a pipeline which yields a list.
 */
function getcsl(obj, cb) {
    var self = this;

    if (isstring(obj)) {
        return cb(null, obj.split(','));
    } else if (obj instanceof Command) {
        sys.read(self, obj, {}, ef(cb, function(data) {
            return cb(null, data);
        }));
    } else {
        return cb("Invalid field specification");
    }
}

function _lookup_fs(uri, mountopts, fslist) {
    var optstr = JSON.stringify(obj2list(mountopts)),
        u = URI.parse(uri);
    for (var i = 0, max = fslist.length; i < max; i++) {
        var fs = fslist[i];
        if (fs.Uri.authority() === u.authority() &&
            (optstr === "[]" || optstr === JSON.stringify(obj2list(fs.opts)))) {
            return fs;
        }
    }
    return null;
}

/*
 * edivs ("extra" divs) are added to pterms by Shell as a place where commands
 * in the middle of a pipeline can dump their iframes, etc. such that those
 * divs appear in pipeline order. e.g. cmd1 | cmd2; cmd3 | cmd4 | cmd5 will
 * have divs appearing in the order cmd1, cmd2, cmd3, cmd4, cmd5.
 * edivs are nested within parent shells' edivs to achieve the above pipeline
 * order.
 *
 * A command must indicate that it would like an ediv by setting self.ediv
 * to null. If creating a Shell by hand, you need to supply it with an ediv as
 * well.
 */

function mkediv(parent_div) {
    var ediv = $('<div class="pterm-ediv"></div>');
    parent_div.append(ediv);
    return ediv;
}

var ps_topics = {};
function publish(channel, data) {
    if (ps_topics[channel] === undefined) {
        ps_topics[channel] = $.Callbacks('memory');
    }
    return ps_topics[channel].fire(data);
}

function subscribe(channel, cb) {
    if (ps_topics[channel] === undefined) {
        ps_topics[channel] = $.Callbacks('memory');
    }
    return ps_topics[channel].add(cb);
}

function unsubscribe(channel, cb) {
    if (ps_topics[channel]) {
        ps_topics[channel].remove(cb);
    }
}

function assert() {
    var args = [].slice.call(arguments),
        name = 'ASSERT',
        cond, rest;

    if (isstring(args[0])) {
        name = name + ': ' + args[0];
        cond = args[1];
        rest = args.slice(2);
    } else {
        cond = args[0];
        rest = args.slice(1);
    }
    if (!cond) {
        var e = new Error(name);
        console.log(name, rest);
        console.log(e.stack);
        throw e;
    }
}

/*
 * Hack to write multi-line string in code without backslashes.
 * multiline(function() {/*
 * some string
 * another string
 * }* /
 * The previous line self-comments the limitations of this approach - string
 * cannot contain an end-comment sequence.
 */
function multiline(f) {
    return f.toString().split('\n').slice(1, -1).join('\n');
}

/*
 * Convert string to base10 float after stripping leading and trailing
 * whitespace. `remove` is a 'cleaner' regex which is replaced with ''.
 * Defaults to '/,/g', thus removing numerical comma separators.
 * Pass null as the second argument to disable comma removal.
 */

function strtonum(str, remove) {
    if (remove === undefined) {
        remove = /,/g;
    }
    var cleaned = str.trim();
    if (remove) {
        cleaned = cleaned.replace(remove, '');
    }
    var num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
}

function popen(cmd, context, shell, opts) {
    shell = shell || initshell;
    var si = context ? context.stdin : null,
        so = context ? context.stdout : null,
        se = context ? context.stderr : null,
        shopts = (opts && opts.shopts) ? opts.shopts : "-c",
        ctext = {};

    if (si) {
        if (si instanceof Array) {
            si = new RedirIn({shell: shell}, si);
        } else if (!si instanceof Command) {
            return err("stdin should be a list or a Command");
        }
        ctext.stdin = si;
    }
    if (so) {
        if (isstring(so)) {
            var maindiv = $(so);
            if (maindiv.length === 0) {
                return err("DOM element " + so + " does not exist");
            }
            var termdiv = $('<div class="pterm-root"/>').appendTo(maindiv),
                term = new Pterm({move: false}, termfs.root, termdiv),
                stdout = new Stdout({shell: shell}, term);

            ctext.stdout = stdout;
            ctext.stderr = term;
        } else if (so instanceof Command) {
            ctext.stdout = so;
        } else {
            return err("stdout should be a string specifying a div or a Command");
        }
    }
    if (se) {
        if (typeof se.append !== 'function') {
            return err("stderr should be an object implementing 'append'");
        }
        ctext.stderr = se;
    }
    var subsh = new Shell({argv: ['sh', shopts, cmd], shell: shell});
    var pipe = makepipe(subsh, ctext);
    return pipe;

    function err(str) {
        var eobj = {
            next: function(opts, cb) {
                return cb(str);
            },
            read: function(opts, cb) {
                return cb(str);
            }
        };
        return eobj;
    }
}

pigshell.publish = publish;
pigshell.subscribe = subscribe;
pigshell.unsubscribe = unsubscribe;
pigshell.popen = popen;
pigshell.err_stringify = err_stringify;
pigshell.multiline = multiline;
pigshell.hef = hef;

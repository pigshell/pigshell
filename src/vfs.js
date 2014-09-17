/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var VFS = {
    uri_handler_list: [],
    media_handler_list: [],
    media_ui_list: [],

    init: function() {
    },

    register_uri_handler: function(pattern, handler, opts, pri) {
        var self = this;

        self.uri_handler_list = register_handler(self.uri_handler_list, pattern, handler, opts, pri);
    },

    unregister_uri_handler: function(pattern, handler) {
        var self = this;

        self.uri_handler_list = unregister_handler(self.uri_handler_list,
            pattern, handler);
    },

    register_media_handler: function(pattern, handler, opts, pri) {
        var self = this;

        self.media_handler_list = register_handler(self.media_handler_list,
            pattern, handler, opts, pri);
    },

    unregister_media_handler: function(pattern, handler) {
        var self = this;

        self.media_handler_list = unregister_handler(self.media_handler_list,
            pattern, handler);
    },

    register_media_ui: function(pattern, handler, opts, pri) {
        var self = this;

        self.media_ui_list = register_handler(self.media_ui_list,
            pattern, handler, opts, pri);
    },

    unregister_media_ui: function(pattern, handler) {
        var self = this;

        self.media_ui_list = unregister_handler(self.media_ui_list,
            pattern, handler);
    },

    lookup_uri_handler: function(uri) {
        var self = this;
        return _lookup_handler(self.uri_handler_list, uri);
    },

    lookup_handler: function(name) {
        var self = this,
            list = self.uri_handler_list;

        for (var i = 0, max = list.length; i < max; i++) {
            if (list[i].handler.fsname === name) {
                return list[i];
            }
        }
        return null;
    },

    lookup_media_handler: function(media_type) {
        var self = this;
        return _lookup_handler(self.media_handler_list, media_type);
    },

    lookup_media_ui: function(media_type) {
        var self = this;
        return _lookup_handler(self.media_ui_list, media_type);
    },

    /*
     * Converts URI to a file object. URI may have embedded options as hash
     * fragment, or explicitly supplied as in the case of mount.
     * We merge both options, because URI-options may specify URI handler as
     * well (e.g. a bookmark of an apachedir URL may be
     * https://kernel.org/pub/linux/#fs=apachedir)
     */

    lookup_uri: function(uri, opts, cb) {
        var self = this,
            u = URI.parse(uri),
            frag = u.fragment(),
            fragopts = frag ? optstr_parse(frag) : {},
            url = u.setFragment('').toString(),
            mountopts = $.extend(true, {}, opts.mountopts, fragopts),
            entry = mountopts.fs ? self.lookup_handler(mountopts.fs) : self.lookup_uri_handler(url),
            handler = entry ? entry.handler : null,
            opts2 = $.extend({}, opts, {mountopts: mountopts});

        if (!handler) {
            return cb(E('EPROTONOSUPPORT'));
        }
        delete mountopts['fs'];
        
        return handler.lookup_uri(url, opts2, cb);
    }
};

function register_handler(plist, pattern, handler, opts, pri) {
    var qlist = plist.slice(0);

    qlist.push({pattern: pattern, handler: handler, opts: opts, priority: pri});
    qlist = qlist.sort(function(a, b) {
        if (a.pattern > b.pattern) {
            return -1;
        } else if (a.pattern < b.pattern) {
            return 1;
        } else {
            return (a.priority > b.priority) ? -1 : ((a.priority < b.priority) ? 1 : 0);
        }
    });
    return qlist;
}

function unregister_handler(plist, pattern, handler) {
    var qlist = plist.slice(0);

    qlist = qlist.filter(function(a) { return a.pattern !== pattern && a.handler !== handler;});
    return qlist;
}

function _lookup_handler(list, pattern) {
    for (var i = 0, max = list.length; i < max; i++) {
        if (pattern.indexOf(list[i].pattern) === 0) {
            return list[i];
        }
    }
    return null;
}

var Filesystem = function(mountopts) {
    this.root = undefined; 
    this.mountopts = mountopts || {};
}; 

var File = function() {
/*
    this.name = undefined; // Name, unique within directory
    this.ident = undefined; // File ID, index in FS file cache
    this.ctime = Date.now(); // Time of creation
    this.atime = Date.now(); // Time of access
    this.mtime = Date.now(); // Time of modification
    this.owner = 'me'; // Some representation of owner
    this.readable = undefined; // Read permission. 1 = readable, 0 = not
    this.writable = undefined; // Write permission. 1 = writable, 0 = not
    this.fs = undefined; // Containing fs object (?)
    this.mime = undefined; // Mime type, describes data contents
    this.data = undefined; // Pointer to data, or the data itself
    this.__id = global_id++;
*/
    if (typeof arguments[0] === 'object') {
        $.extend(this, arguments[0]);
    }
    if (this.mime === 'directory' && this.readdir === undefined) {
        this.readdir = this.generic_readdir;
    }
};

File.prototype.toString = function() {
    return this.name;
};

File.prototype.generic_readdir = function(opts, cb) {
    var self = this;
    if (!isdir(self)) {
        return cb(E('ENOTDIR'));
    }
    var files = self.populated ? self.files : {};
    return cb(null, files);
};

File.prototype.updatesize = function(cb) {
    var self = this;

    if (isdir(self)) {
        self.size = Object.keys(self.files).length;
    }
};

File.prototype.generic_lookup = function(name, opts, cb) {
    var self = this;
    if (!isdir(self)) {
        return cb(E('ENOTDIR'));
    }
    if (!self.populated) {
        self.readdir(opts, function(err) {retblock(err);});
    } else {
        retblock(null);
    }

    function retblock(err) {
        if (err) {
            return cb(err);
        }
        if (name === '') { // '.', aka current directory
            return cb(null, fstack_top(self));
        }
        if (self.files[name]) {
            return cb(null, fstack_top(self.files[name]));
        } else {
            return cb(E('ENOENT'), null);
        }
   }
};

File.prototype.lookup = function(name, opts, cb) {
    return this.generic_lookup(name, opts, cb);
};

File.prototype.search = function(name, opts, cb) {
    var self = this;

    function retblock() {
        var re = minimatch.makeRe(name);
        var res = Object.keys(self.files).filter(function(f) { return !!f.match(re);}).map(function(i) { return [i, fstack_top(self.files[i])];});
        return cb(null, res);
    }

    if (!self.populated) {
        self.readdir(opts, ef(cb, retblock));
    } else {
        retblock();
   }
};

/*
File.prototype.bundle = function(opts, cb) {
    return cb(null, { this.name: this });
}
*/

/*
 * Most operations, if unhandled, will propagate down towards the base layer
 * of a file stack
 */

["mkdir", "putdir", "rm", "getmeta", "getdata", "read", "append", "stat",
    "unbundle"].forEach(function(op) {
    File.prototype[op] = function() {
        return this._lfile ? this._lfile[op].apply(this._lfile, arguments) :
            this.enosys.apply(this, arguments);
    };
});

/*
 * Update is the only operation so far which bubbles up through the file stack
 * from the base layer
 */

File.prototype.update = function()  {
    var args = [].slice.call(arguments),
        cb = args[args.length - 1];
    return this._ufile ? this._ufile.update.apply(this._ufile, arguments) :
        cb(null, this);
};

File.prototype.enosys = function() {
    var args = [].slice.call(arguments),
        cb = args[args.length - 1];
    if (typeof cb === 'function') {
        return cb(E('ENOSYS'));
    } else {
        return E('ENOSYS');
    }
};

Namespace = function(root) {
    this.root = root;
    this.mounts = {};
};

Namespace.prototype.lookup = function(path, opts, cb) {
    var comps = path.split('/'),
        uri = URI.parse(path),
        context = opts.context,
        curdir,
        wdcomps,
        idlist = [],
        self = this;

    function _idstring(file) {
        var l = [],
            f = fstack_base(file),
            name = f.name || "noname";
        while (f) {
            var mime = f.mime || "nomime";
            l.push(f.__id + "(" + mime + ")");
            f = f._ufile;
        }
        return name + ":" + l.join("|") + ":" + file.__id;
    }
    if (uri.isAbsolute()) {
        return VFS.lookup_uri(path, opts, ef(cb, function(res) {
            if (opts.retcomps) {
                wdcomps = context ? context.cwd.comps.slice(0) :
                    [{name: '/', dir: self.root}];
                uri.setFragment('');
                wdcomps.push({name: uri.toString(), dir: fstack_base(res)});
                return cb(null, [fstack_top(res), wdcomps]);
            } else {
                return cb(null, fstack_top(res));
            }
        }));
    }
    if (!(comps[0] === '' && comps.length > 1) && context) {
        curdir = context.cwd.cwd;
        wdcomps = context.cwd.comps.slice(0);
    } else {
        curdir = self.root;
        wdcomps = [{name: '/', dir: curdir}];
    }

    async.forEachSeries(comps, function(item, lcb) {
        if (curdir === undefined) {
            return lcb(E('ENOENT'));
        }
        if (item === '.' || item === '') {
            return lcb(null);
        }
        if (item === '..') {
            if (wdcomps.length > 1) {
                wdcomps.pop();
                curdir = wdcomps[wdcomps.length - 1].dir;
            }
            return lcb(null);
        }
        var newdir = pathjoin(self.pwd(wdcomps), item);
        if (self.mounts[newdir]) {
            curdir = self.mounts[newdir].dir;
            wdcomps.push({name: item, dir: curdir});
            return lcb(null);
        } else {
            var curdirtop = fstack_top(curdir);
            //idlist.push(_idstring(curdir));
            curdirtop.lookup(item, opts, function(err, res) {
                if (err) {
                    return lcb(err);
                }
                curdir = fstack_base(res);
                wdcomps.push({name: item, dir: curdir});
                return lcb(null);
            });
        }
    },
    function(err) {
        //console.log("lookup " + path + ": " + idlist.join(","));
        if (err) {
            return cb(err);
        }
        if (opts.retcomps) {
            return cb(null, [fstack_top(curdir), wdcomps]);
        } else {
            return cb(null, fstack_top(curdir));
        }
    });
};

Namespace.prototype.search = function(path, opts, cb) {
    var comps = pathsplit(path),
        last = comps[1],
        pdir = comps[0],
        opts2 = $.extend({}, opts, {retcomps: true});

    if (last === '.' || last === '..') {
        pdir = pathjoin(pdir, last);
        last = '';
    }
    this.lookup(pdir, opts2, function(err, res) {
        if (err) {
            return cb(err, null);
        }
        var dir = res[0],
            wd = res[1].pop();
        if (last === '') {
            return cb(null, [wd.name, dir]);
        } else if (!isdir(dir)) {
            return cb(null, []);
        }
        if (dir.search) {
            return dir.search(last, opts, cb);
        } else {
            return File.prototype.search.call(dir, last, opts, cb);
        }
    });
};

Namespace.prototype.pwd = function(wdcomps) {
    return pathnorm(wdcomps.map(function(i) { return i.name; }).join('/'));
};

Namespace.prototype.mount = function(mntpt, root, opts, cb) {
    var self = this,
        path = pathnorm(mntpt);

    if (path[0] != '/') {
        return cb({code: 'EINVAL', msg: 'mntpoint must be absolute path'});
    }
    if (path[path.length - 1] === '/') {
        path = path.slice(0, -1);
    }
    self.lookup(path, opts, function (err, curdir) {
        if (err) {
            return cb(err);
        }
        if (curdir === undefined) {
            return cb(E('ENOENT'));
        }
        if (path in self.mounts) {
            return cb({code: 'EINVAL', msg: 'mntpt already used'});
        }
        // XXX  Ugh. Tell ls and others that this is a mountpoint. Bad bad bad.
        root._mounted = path;
        // XXX Not sure why this div stuff is lying here
        if (root.html === undefined && root.htmlClass) {
            root.html = '<div class="' + root.htmlClass + '">' + path.slice(1) + '</div>';
        }
        self.mounts[path] = {dir: fstack_base(root), opts: opts};
        return cb(null, null);
    });
};

Namespace.prototype.umount = function(mntpt, cb) {
    var self = this;

    if (!(mntpt in self.mounts)) {
        return cb(E('ENOENT'));
    }
    delete self.mounts[mntpt];
    return cb(null, null);
};

Namespace.prototype.mountlist = function() {
    return this.mounts;
};

var JsonFile = function() {
    this.ctime = this.mtime = Date.now();
    JsonFile.base.apply(this, arguments);
    if (this.mime === 'directory') {
        this.readdir = this.generic_readdir;
    }
};

inherit(JsonFile, File);

/*
 * Add a directory entry
 */

JsonFile.prototype.addfile = function(obj, name) {
    var self = this,
        newfile = {
            name: name,
            ident: pathjoin(self.ident, name),
            pident: self.ident,
            readable: true,
            writable: true,
            fs: self.fs,
            html: '<div class="pfile">' + name + '</div>',
            size: 0
        };
    if (obj.__lookupGetter__(name) || obj.__lookupSetter__(name)) {
        newfile.mime = 'text/plain';
    } else if (obj[name] === null || obj[name] === undefined) {
        newfile.mime = 'text/plain';
        newfile.size = 0;
    } else if (obj[name].constructor === Object || obj[name]._jfs) {
        newfile.mime = 'directory';
        newfile.html = '<div class="pfolder">' + name + '</div>';
    } else if (isstring(obj[name])) {
        newfile.mime = 'text/plain';
        newfile.size = obj[name].length;
    } else {
        newfile.mime = 'unknown/unknown';
    }

    if (newfile.mime === 'directory') {
        newfile.files = {};
        newfile.populated = false;
    } else if (obj[name] === undefined || obj[name] === null) {
        newfile.data = {data: ''};
    } else {
        newfile.data = {data: obj[name]};
    }
    var newf = new JsonFile(newfile);
    self.files[name] = newf;
    self.updatesize();
};

JsonFile.prototype.generic_readdir = function(opts, cb) {
    var self = this;
    if (self.fs.opts.cache && self.populated) {
        return cb(null, self.files);
    }
    var obj = self.fs.iread(self.ident);
    self.files = {};
    if (obj._jfs !== undefined) {
        for (var i = 0; i < obj._jfs.length; i++) {
            self.addfile(obj, obj._jfs[i]);
        }
    } else {
        for (var f in obj) {
            self.addfile(obj, f);
        } 
    }
    if (self.fs.opts.cache) {
        self.populated = true;
    }
    return cb(null, self.files);
};


JsonFile.prototype.read = function(opts, cb) {
    var self = this;

    if (isdir(self)) {
        return cb(E('EISDIR'), self.name);
    } else if (self.name == 'coral') {
        /*$.get('http://query.yahooapis.com/v1/public/yql', {q: 'select * from html where url="http://reddit.com"', format: 'xml', callback:'?'}, function(data) {
            return cb(null, data);
        });*/
        /*
         $.getJSON("https://query.yahooapis.com/v1/public/yql?"+ "q=select%20*%20from%20html%20where%20url%3D%22"+ encodeURIComponent('http://reddit.com')+ "%22&format=xml'&callback=?", function(data){
            return cb(null, data.results[0]);
         });
         */
        $.get("http://www.html5rocks.com/en/", function(data){
            return cb(null, data);
        });
    } else if (self.data.data !== undefined) {
        if (self.data.data === null) {
            return cb(null, '');
        } else {
            return cb(null, self.data.data);
        }
    } else {
        return cb({code: 'EINVAL', msg: 'unknown data format'}, null);
    }
};

JsonFile.prototype.append = function(item, opts, cb) {
    var self = this;

    if (self.mime !== 'text/plain') {
        return cb(E('EINVALFILE'), null);
    }
    if (!isstring(item)) {
        return cb(E('EINVAL'), null);
    }
    var pobj = self.fs.iread(self.pident);
    pobj[self.name] = pobj[self.name] + item;
    self.data.data = pobj[self.name];
    return cb(null, null);
};


JsonFile.prototype.putdir = function(name, dlist, opts, cb) {
    var self = this;

    if (dlist.length === 0) {
        return cb(null, null);
    }
    var obj = self.fs.iread(self.ident);

    if (self.files[name] && isdir(self.files[name])) {
        return cb(E('EISDIR'), null);
    }
    if (isstring(dlist[0])) {
        obj[name] = dlist.join('');
    } else {
        obj[name] = dlist[0];
    }
    self.addfile(obj, name);
    return cb(null, null);
};

JsonFile.prototype.mkdir = function(name, opts, cb) {
    var self = this,
        obj = self.fs.iread(self.ident);

    if (obj[name] !== undefined) {
        return cb(E('EEXIST'), null);
    }
    obj[name] = {};
    self.addfile(obj, name);

    return cb(null, null);
};

JsonFile.prototype.rm = function(name, opts, cb) {
    var self = this,
        obj = self.fs.iread(self.ident);

    var rmf = self.files[name];
    if (rmf === undefined) {
        return cb(E('ENOENT'), null);
    }
    if (isdir(rmf)) {
        if (Object.keys(obj[name]).length) {
            return cb(E('ENOTEMPTY'), null);
        }
    }
    delete obj[name];
    delete self.files[name];
    self.updatesize();
    return cb(null, null);
};

JsonFile.prototype.stat = function(opts, cb) {
    return cb(null, this);
};

var JsonFS = function(obj, opts) {
    JsonFS.base.call(this);
    this.obj = obj; // Object we are shadowing
    this.opts = $.extend({'cache': true}, opts);
    var rootfile = {
        name: '/',
        ident: opts.rootident || '/',
        pident: '/',
        readable: true,
        writable: true,
        fs: this,
        mime: 'directory',
        htmlClass: 'pfolder',
        files: {},
        populated: false
    };
    this.root = new JsonFile(rootfile);
};

inherit(JsonFS, Filesystem);
JsonFS.fsname = "JsonFS";

JsonFS.prototype.iread = function(ident) {
    var rootident = this.root.ident,
        cident = ident.slice(rootident.length),
        comps = cident.split('/');
    var obj = this.obj;
    for (var i = 0; i < comps.length; i++) { 
        if (comps[i] === '') {
            continue;
        }
        obj = obj[comps[i]];
    }
    return obj;
};

/*
 * "System" calls, meant to be called from the context of a command.
 */

var sys = {

    lookup: function(cmd, path, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd}),
            ns = cmd instanceof Shell ? cmd.ns : cmd.shell.ns;
        return ns.lookup(path, opts2, check_live(cb).bind(cmd));
    },

    search: function(cmd, path, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd}),
            ns = cmd instanceof Shell ? cmd.ns : cmd.shell.ns;

        return ns.search(path, opts2, check_live(cb).bind(cmd));
    },

    read: function(cmd, file, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd}),
            base = fstack_base(file);

        return file.read(opts2, check_live(function(err, res) {
            if (err && err.code === 'ESTACKMOD') {
                return fstack_top(base).read(opts2, check_live(cb).bind(cmd));
            } else {
                return cb(err, res);
            }
        }).bind(cmd));
    },

    bundle: function(cmd, file, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return file.bundle(opts2, check_live(cb).bind(cmd));
    },

    putdir: function(cmd, file, name, list, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return file.putdir(name, list, opts2, check_live(cb).bind(cmd));
    },

    unbundle: function(cmd, file, name, data, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return file.unbundle(name, data, opts2, check_live(cb).bind(cmd));
    },

    append: function(cmd, file, data, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return file.append(data, opts2, check_live(cb).bind(cmd));
    },

    stat: function(cmd, file, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return file.stat(opts2, check_live(cb).bind(cmd));
    },

    link: function(cmd, destdir, srcfile, name, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return destdir.link(srcfile, name, opts2, check_live(cb).bind(cmd));
    },

    readdir: function(cmd, dir, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd}),
            base = fstack_base(dir);

        return dir.readdir(opts2, check_live(function(err, res) {
            if (err && err.code === 'ESTACKMOD') {
                return fstack_top(base).readdir(opts2, check_live(cb).bind(cmd));
            } else {
                return cb(err, res);
            }
        }).bind(cmd));
    },

    rm: function(cmd, dir, name, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return dir.rm(name, opts2, check_live(cb).bind(cmd));
    },

    mkdir: function(cmd, dir, name, opts, cb) {
        var opts2 = $.extend({}, opts, {context: cmd});

        return dir.mkdir(name, opts2, check_live(cb).bind(cmd));
    },

    getenv: function(cmd, varname) {
        var shell = cmd instanceof Shell ? cmd : cmd.shell;

        return shell.vars[varname] || [];
    },

    putenv: function(cmd, varname, val) {
        var shell = cmd instanceof Shell ? cmd : cmd.shell,
            varval;

        if (val === undefined) {
            delete shell.vars[varname];
        }
        shell.vars[varname] = val instanceof Array ? val : [val];
    }
};

/*
 * Common file functions, meant to be called from commands
 */

function fread(path, cb) {
    var self = this;
    sys.lookup(self, path, {}, ef(cb, function(file) {
        if (typeof file.read !== 'function') {
            return cb(E('ENOSYS'), null);
        }
        return sys.read(self, file, {}, cb);
    }));
}

function fwrite(path, dlist, cb) {
    var comps = pathsplit(path),
        last = comps[1],
        parentdir = comps[0],
        self = this;

    sys.lookup(self, parentdir, {}, ef(cb, function(dir) {
        if (typeof dir.putdir !== 'function') {
            return cb(E('ENOSYS'));
        }
        return sys.putdir(self, dir, last, dlist, {}, cb);
    }));
}

function fstat(path, cb) {
    var self = this;
    sys.lookup(self, path, {}, ef(cb, function(file) {
        return sys.stat(self, file, {}, function(err, res) {
            if (err) {
                if (err.code === 'ENOSYS') {
                    return cb(null, file);
                }
                return cb(err);
            }
            return cb(null, res);
        });
    }));
}

/* Nobody uses rm, mkdir, fopen so far */
function dirlookup_and_x(op, path, cb) {
    var comps = pathsplit(path),
        last = comps[1],
        parentdir = comps[0],
        self = this;

    sys.lookup(self, parentdir, {}, ef(cb, function(dir) {
        if (typeof dir[op] !== 'function') {
            return cb(E('ENOSYS'));
        }
        return sys[op](self, dir, last, {}, cb);
   }));
}

function rm(path, cb) {
    return dirlookup_and_x.call(this, 'rm', path, cb);
}

function mkdir(path, cb) {
    return dirlookup_and_x.call(this, 'mkdir', path, cb);
}

/*
function fopen(ns, path, flags, cb) {
    ns.lookup(path, function(err, file) {
        if (err) {
            if (!(err.code === 'ENOENT' && flags.create)) {
                return cb(err, null);
            }
            dirlookup_and_x('putdir', ns, path, [''], function(err, res) {
                if (err) {
                    return cb(err, null);
                }
                return ns.lookup(path, cb);
            });
            return;
        }
        if (flags.truncate) {
            dirlookup_and_x('putdir', ns, path, [''], function(err, res) {
                if (err) {
                    return cb(err, null);
                }
                return ns.lookup(path, cb);
            });
        } else {
            return cb(null, file);
        }
    });
}
*/

/*
 * Generate unique names for the purpose of directory entries from
 * long-winded and possibly duplicate fields like photo titles.
 */

function unique_names(list, options) {
    var defaults = {field: 'title', maxlen: 80, connector: '_', start: 1, namefield: 'name', prefix: 'file'};
    var opts = $.extend({}, defaults, options);
        
    var trunc = list.map(function (item) {
        if (item[opts.field] === undefined) {
            item[opts.namefield] = item[opts.field] = opts.prefix;
        } else {
            var f = item[opts.field].toString().slice(0, opts.maxlen).trim();
            f = f.replace(/\/+$/, '');
            f = f.replace(/[\/\n]/g, '-');
            item[opts.namefield] = (f === '') ? opts.prefix : f;
        }
        return item;
    });
    var sorted = trunc.sort(function(a, b) {
        return (a[opts.namefield] < b[opts.namefield]) ? -1 : ((a[opts.namefield] > b[opts.namefield]) ? 1 : 0);
    });
    var results = [],
        suffix = opts.start,
        renaming = false;
    for (var i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1][opts.namefield] == sorted[i][opts.namefield]) {
            renaming = true;
            sorted[i][opts.namefield] = sorted[i][opts.namefield] + opts.connector + suffix;
            suffix++;
        } else if (renaming) {
            sorted[i][opts.namefield] = sorted[i][opts.namefield] + opts.connector + suffix;
            suffix = opts.start;
            renaming = false;
        }
    }
    // Last one
    if (renaming) {
        sorted[i][opts.namefield] = sorted[i][opts.namefield] + opts.connector + suffix;
    }

    return sorted;
}


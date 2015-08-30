/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var Sys = {
};

var VFS = {
    handler: {},

    init: function() {
    },

    register_handler: function(name, klass) {
        VFS.handler[name] = klass;
        klass.defaults = klass.defaults || {};
        klass._jfs = klass._jfs || ["defaults"];
    },

    lookup_handler_name: function(handler) {
        var self = this;

        for (var name in VFS.handler) {
            if (VFS.handler[name] === handler) {
                return name;
            }
        }
        return null;
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
            entry, handler;

        if (mountopts.fs) {
            handler = VFS.handler[mountopts.fs];
            entry = {};
            delete mountopts['fs'];
        } else {
            entry = self.lookup_uri_handler(url);
            handler = entry ? entry.handler: null;
        }
        if (!handler) {
            return cb(E('EPROTONOSUPPORT'));
        }
        mountopts = $.extend(true, {}, handler.defaults, entry.opts, mountopts);
        var opts2 = $.extend({}, opts, {mountopts: mountopts});

        return handler.lookup_uri(url, opts2, cb);
    },

    lookup_tx: function(tx) {
        var self = this,
            entry = self.lookup_tx_handler(tx);

        return (entry && entry.handler) ? new entry.handler(entry.opts) : null;
    }
};

["uri", "media", "media_ui", "tx"].forEach(function(x) {
    var dict = x + "_handler",
        lst = x + "_handler_list";

    VFS[lst] = [];
    VFS[dict] = {
        _jfs_notify: function() {
            VFS[lst] = make_handler_list(VFS[dict]);
        }
    };
    VFS["register_" + dict] = function(pattern, handler, opts) {
        return register_handler(VFS[dict], pattern, handler, opts);
    };
    VFS["unregister_" + dict] = function(pattern, handler) {
        return unregister_handler(VFS[dict], pattern, handler);
    };
    VFS["lookup_" + dict] = function(pattern) {
        return lookup_handler(VFS[lst], pattern);
    };
    Sys[x] = VFS[dict];
});

Sys.handler = VFS.handler;

function register_handler(dir, pattern, handler, opts) {
    var ep = enc_uri_path(pattern);

    dir[ep] = $.extend({}, opts, {handler: handler});
    dir._jfs_notify();
}

function unregister_handler(dir, pattern) {
    delete dir[enc_uri_path(pattern)];
    dir._jfs_notify();
}

function make_handler_list(pdict) {
    var qlist = [];
    for (var p in pdict) {
        if (p === '_jfs_notify') {
            continue;
        }
        var entry = pdict[p],
            hname = entry.handler || "unknown",
            opts = $.extend({}, entry),
            handler = VFS.handler[hname];

        if (handler) {
            delete opts["handler"];
            qlist.push({pattern: dec_uri(p), handler: handler, opts: opts});
        }
    }
    qlist = qlist.sort(function(a, b) {
        return (a.pattern > b.pattern) ? -1 : (a.pattern < b.pattern) ? 1 : 0;
    });
    return qlist;
}

function lookup_handler(list, pattern) {
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
        self.readdir(opts, ef(cb, retblock));
    } else {
        retblock(self.files);
    }

    function retblock(files) {
        if (name === '') { // '.', aka current directory
            return cb(null, fstack_top(self));
        }
        if (files[name]) {
            return cb(null, fstack_top(files[name]));
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

    function retblock(files) {
        var re = minimatch.makeRe(name);
        var res = Object.keys(files).filter(function(f) { return !!f.match(re);}).map(function(i) { return [i, fstack_top(files[i])];});
        return cb(null, res);
    }

    if (!self.populated) {
        self.readdir(opts, ef(cb, retblock));
    } else {
        retblock(self.files);
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

["mkdir", "putdir", "rm", "getmeta", "read", "append", "stat",
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

var MediaHandler = function(meta) {
    MediaHandler.base.call(this);

    this.name = meta.name;
    this.ident = meta.ident;
    this.fs = meta.fs;
    this.mime = this.mime || meta.mime;

    this.mtime = -1;
    this.size = 0;
    this.readable = true;

    this.html = sprintf('<div class="pfile"><a href="%s" target="_blank">{{name}}</a></div>', this.ident);
    assert("MediaHandler.1", this.ident !== undefined && this.name !== undefined && this.fs !== undefined && this.mime, this, meta);
};

inherit(MediaHandler, File);

MediaHandler.prototype.append = fstack_passthrough("append");

MediaHandler.prototype.update = function(meta, opts, cb) {
    var self = this;

    mergeattr_x(self, meta, ["name", "ident", "fs", "mime"]);
    return File.prototype.update.call(self, meta, opts, cb);
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

        return file.read(opts2, check_live(cb).bind(cmd));
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

        return dir.readdir(opts2, check_live(cb).bind(cmd));
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
            f = f.replace(/\//g, '%2F');
            f = f.replace(/\n/g, '-');
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


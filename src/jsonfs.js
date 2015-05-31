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

JsonFile.prototype.mkfile = function(obj, name) {
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
    } else if (_jfs_isdir(obj[name])) {
        newfile.mime = 'directory';
        newfile.count = obj[name]._jfs ? obj[name]._jfs.length :
            Object.keys(obj[name]).length;
        newfile.html = '<div class="pfolder">' + name + '</div>';
    } else if (isstring(obj[name])) {
        newfile.mime = 'text/plain';
        newfile.size = obj[name].length;
    } else if (obj[name] instanceof Blob) {
        newfile.mime = obj[name].type || 'application/octet-stream';
    }

    return new JsonFile(newfile);
};

JsonFile.prototype.generic_readdir = function(opts, cb) {
    var self = this,
        obj = self.fs.iread(self.ident),
        files = {};


    if (obj._jfs !== undefined) {
        for (var i = 0; i < obj._jfs.length; i++) {
            files[obj._jfs[i]] = self.mkfile(obj, obj._jfs[i]);
        }
    } else {
        for (var f in obj) {
            files[f] = self.mkfile(obj, f);
        } 
    }
    return cb(null, files);
};

JsonFile.prototype.read = function(opts, cb) {
    var self = this,
        pobj = self.fs.iread(self.pident);

    var val = pobj[self.name];
    if (val && _jfs_isdir(val)) {
        return cb(E('EISDIR'), self.name);
    }
    if (val !== undefined) {
        if (val === null) {
            return cb(null, '');
        } else {
            return cb(null, val);
        }
    } else {
        return cb({code: 'EINVAL', msg: 'unknown data format'}, null);
    }
};

JsonFile.prototype.append = function(item, opts, cb) {
    var self = this,
        pobj = self.fs.iread(self.pident);

    if (isstring(pobj[self.name])) {
        pobj[self.name] = pobj[self.name] + item;
    } else if (pobj[self.name] instanceof Blob) {
        pobj[self.name] = new Blob([pobj[self.name], item]);
    }
    return cb(null, null);
};


JsonFile.prototype.putdir = function(name, dlist, opts, cb) {
    var self = this;

    if (dlist.length === 0) {
        return cb(null, null);
    }
    var obj = self.fs.iread(self.ident);

    if (obj[name] && _jfs_isdir(obj[name])) {
        return cb(E('EISDIR'), null);
    }
    if (isstring(dlist[0])) {
        obj[name] = dlist.join('');
    } else if (dlist.length === 1) {
        obj[name] = dlist[0];
    } else {
        obj[name] = new Blob(dlist);
    }
    return cb(null, null);
};

JsonFile.prototype.mkdir = function(name, opts, cb) {
    var self = this,
        obj = self.fs.iread(self.ident);

    if (obj[name] !== undefined) {
        return cb(E('EEXIST'), null);
    }
    obj[name] = {};
    return cb(null, null);
};

JsonFile.prototype.rm = function(name, opts, cb) {
    var self = this,
        obj = self.fs.iread(self.ident);

    if (obj[name] === undefined) {
        return cb(E('ENOENT'), null);
    }
    if (Object.keys(obj[name]).length) {
        return cb(E('ENOTEMPTY'), null);
    }
    delete obj[name];
    return cb(null, null);
};

JsonFile.prototype.stat = function(opts, cb) {
    return cb(null, this);
};

var JsonFS = function(obj, opts) {
    JsonFS.base.call(this);
    this.obj = obj; // Object we are shadowing
    this.opts = $.extend({}, opts);
    var rootfile = {
        name: '/',
        ident: opts.rootident || '/',
        pident: '/',
        readable: true,
        writable: true,
        fs: this,
        mime: 'directory',
        htmlClass: 'pfolder'
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

function _jfs_isdir(obj) {
    return obj.constructor === Object || obj._jfs;
}

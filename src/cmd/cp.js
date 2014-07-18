/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Cp(opts) {
    var self = this;

    Cp.base.call(self, opts);
}

inherit(Cp, Command);

Cp.prototype.usage = 'cp           -- copy files\n\n' +
    'Usage:\n' +
    '    cp [-arcv] [-o <opts>] [-X <regex>] <source_file> <target_file>\n' +
    '    cp [-arcv] [-o <opts>] [-X <regex>] <source_file> <target_directory>\n' +
    '    cp [-arcv] [-o <opts>] [-X <regex>] <source_file>... <target_directory>\n' +
    '    cp [-arcv] [-o <opts>] [-X <regex>] <target_directory>\n' +
    '    cp <-h | --help>\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n' + 
    '    -a           Archive metadata, resources, data in bundle format\n' +
    '    -r           Recursively descend source directory\n' +
    '    -v           Verbose reporting\n' +
    '    -c           Resume interrupted copy a la wget -c\n' +
    '    -X <regex>   Exclude paths matching regex\n';

Cp.prototype.internalUsage = 'cp           -- copy files\n\n' +
    'Usage:\n' +
    '    cp [-arcv] [-o <opts>] [-X <regex>] <file>...\n' +
    '    cp <-h | --help>\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n' +
    '    -X <regex>   Exclude paths matching regex\n';

Cp.prototype.next = check_next(do_docopt(pathargs(function() {
    var self = this,
        cpone = self.docopts['-r'] ? cprecursive : cpfile;

    if (self.inited) {
        return next();
    }

    /* First time */
    self.inited = true;
    self.retval = true;
    self.cliopts = optstr_parse(self.docopts['-o'], true);
    self.cpopts = self.cliopts.cp || {};
    delete self.cliopts['cp'];
    self.chunksize = self.cpopts.chunksize || (4 * 1024 * 1024);
    if (self.docopts['-X']) {
        try {
                self.xregex = new RegExp(self.docopts['-X']);
        } catch (e) {
            return self.exit(e.message);
        }
    }

    sys.lookup(self, self.target, self.cliopts, function(err, tfile) {
        if (err) {
            if (err.code !== 'ENOENT') {
                return self.exit(err, self.target);
            }
            if (self.mode === 'multi') {
                return self.exit(err, self.target);
            }
        } else {
            if (isrealdir(tfile)) {
                self.tdir = fstack_base(tfile);
                self.tdirpath = self.target;
                return next();
            } else if (self.mode === 'multi') {
                return self.exit(E('ENOTDIR'), self.target);
            }
        }
        /* mode = 'single', err = ENOENT */
        var comps = pathsplit(self.target),
            last = comps[1],
            parentdir = comps[0];
        sys.lookup(self, parentdir, self.cliopts, function(err, pfile) {
            if (err) {
                return self.exit(err, parentdir);
            } else {
                self.tdir = fstack_base(pfile);
                self.tdirpath = parentdir;
                self.tname = last;
                return next();
            }
        });
    });

    function next() {
        self.unext({}, cef(self, function(file) {
            if (file === null) {
                return self.exit(self.retval);
            }
            var spath = isstring(file) ? file : isstring(file._path) ? file._path : null,
                tname = self.tname || basename(spath);
            if (!spath) {
                return self.exit("Invalid file specification: " + file.toString());
            }

            cpone(fstack_top(self.tdir), self.tdirpath, tname, spath,
                function(err, res) {
                if (err) {
                    self.retval = false;
                }
                return next();
            });
        }));
    }

    /* Target directory object, target filename, src path */
    function cpfile(tdir, tdirpath, tname, srcpath, cb) {
        if (self.xregex && srcpath.match(self.xregex)) {
            cplog(srcpath, null, {status: 'skipped', more: 'excluded'});
            return cb(null, null);
        }
        fstat.call(self, srcpath, function(err, file) {
            if (err) {
                self.errmsg(err, srcpath);
                return cb(err);
            }
            return cpfile2(tdir, tdirpath, tname, file, function(err, res, stats) {
                cplog(srcpath, err, stats);
                return cb(err, res);
            });
        });
    }

    function simplecp(tdir, tdirpath, tname, sfile, cb) {
        var cliopts = self.cliopts;
        if (typeof sfile.read !== 'function') {
            return cb(E('ENOSYS'));
        }
        var fc = tdir.fs.constructor.fileclass,
            do_stream = fc && fc.prototype.hasOwnProperty('append') && (sfile.size > self.chunksize || cliopts.range);
        if (cliopts.range) {
            if (!do_stream) {
                return cb(E('EINVAL'));
            }
        }

        sys.lookup(self, pathjoin(tdirpath, tname), cliopts,
            function(err, res) {
            if (do_stream && (err || !self.docopts['-c'])) {
                /* in streaming, we use append. so create a 0 length file */
                var popts = $.extend({}, cliopts, {mime: sfile.mime});
                sys.putdir(self, tdir, tname, [''], popts, ef(cb, function() {
                    sys.lookup(self, pathjoin(tdirpath, tname), cliopts,
                        ef(cb, cp3));
                }));
            } else {
                return cp3(res);
            }
        });

        function cp3(tfile) {
            var opts = $.extend({}, self.cliopts, {chunksize: self.chunksize});
                
            if (tfile && self.docopts['-c'] && !opts.range) {
                if (sfile.size > 0) {
                    if (sfile.size === tfile.size) {
                        return cb(null, null, {status: 'skipped', more: 'size check'});
                    }
                    opts.range = {off: tfile.size, len: -1};
                } else if (sfile.mtime <= tfile.mtime) {
                    return cb(null, null, {status: 'skipped', more: 'mtime check'});
                }
            }
            if (do_stream) {
                var tfbase = fstack_base(tfile);
                fproc.call(self, sfile, opts, function(res, range, acb) {
                    sys.append(self, fstack_top(tfbase), res, self.cliopts,
                        ef(cb, acb));
                }, function(err, res, stats) {
                   fstack_invaldir(tdir); // Hack to get ls see updated size
                   return cb.apply(null, arguments);
                });
            } else {
                var popts = $.extend({}, self.cliopts, {mime: sfile.mime});
                sys.read(self, sfile, self.cliopts, ef(cb, function(data) {
                    sys.putdir(self, tdir, tname, [data], popts, cb);
                }));
            }
        }
    }

    /* Target directory object, target filename, src file object */
    function cpfile2(tdir, tdirpath, tname, src, cb) {
        if (self.docopts['-a'] && typeof tdir.unbundle !== 'function') {
                return cb(E('ENOSYS'));
        } else if (self.docopts['-a'] && typeof src.bundle === 'function') {
            sys.bundle(self, src, self.cliopts, ef(cb, function(data) {
                sys.unbundle(self, tdir, tname, data,
                    $.extend({}, self.cliopts, {'resume': self.docopts['-c']}), cb);
            }));
        } else if (isrealdir(src)) {
            sys.mkdir(self, tdir, tname, self.cliopts, function(err, dir) {
                if (!err || err.code === 'EEXIST') {
                    sys.lookup(self, pathjoin(tdirpath, tname), self.cliopts,
                        ef(cb, function(dir) {
                        return cb(null, fstack_base(dir));
                    }));
                } else {
                    return cb(err);
                }
            });
        } else {
            simplecp(tdir, tdirpath, tname, src, cb);
        }
    }

    function cprecursive(tdir, tdirpath, tname, src, cb) {
        if (self.xregex && src.match(self.xregex)) {
            cplog(src, null, {status: 'skipped', more: 'excluded'});
            return cb(null, null);
        }
        fstat.call(self, src, function(err, file) {
            if (err) {
                self.errmsg(err, src);
                return cb(err);
            }
            var srcbase = fstack_base(file);
            function cpr_descend(dir) {
                var s = fstack_top(srcbase);
                if (isrealdir(s)) {
                    sys.readdir(self, s, self.cliopts, ef(cb, function(files) {
                        var fnames = Object.keys(files);
                        async.forEachSeries(fnames, function(fname, acb) {
                            cprecursive(fstack_top(dir), pathjoin(tdirpath, tname), fname, pathjoin(src, fname), function(err, res) {
                                return soguard(self, acb.bind(null, null));
                            });
                        }, function(err) {
                            return cb(null, null);
                        });
                    }));
                } else {
                    return cb(null, null);
                }
            }
            if (tname === '') { // trailing slash
                return cpr_descend(tdir);
            }
            cpfile2(tdir, tdirpath, tname, file, function(err, dir, stats) {
                cplog(src, err, stats);
                return cpr_descend(dir);
            });
        });
    }

    function cpmany(tdir, tdirpath, sources) {
        var base = fstack_base(tdir);
        async.forEachSeries(sources, function(sourceFile, acb) {
            cpone(fstack_top(base), tdirpath, basename(sourceFile), sourceFile, function(err, res) {
                return soguard(self, acb.bind(null, null));
            });
        }, function(err) {
            return self.exit(err, null);
        });
    }

    function cplog(src, err, stats) {
        if (err) {
            self.errmsg(err, src);
            return;
        }
        if (!self.docopts['-v']) {
            return;
        }
        var msg = 'copied ' + src;
        if (stats) {
            if (stats.status) {
                msg = stats.status + ' ' + src;
            }
            if (stats.more) {
                msg += ' (' + stats.more + ')';
            }
            if (stats.range) {
                msg += sprintf(" (offset: %d length: %d)", stats.range.off,
                    stats.range.len);
            }
        } else {
            msg = 'copied ' + src;
        }
        self.errmsg(msg);
    }
})));

Command.register("cp", Cp);

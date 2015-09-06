/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Rm(opts) {
    var self = this;

    Rm.base.call(self, opts);
}

inherit(Rm, Command);

Rm.prototype.usage = 'rm           -- remove file or directory\n\n' +
    'Usage:\n' +
    '    rm [-rvn] [-o <opts>] [<file>...]\n' +
    '    rm -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -r           Recursively remove files\n' +
    "    -n           Go through the motions, but don't remove\n" +
    '    -o <opts>    Option string\n' +
    '    -v           Be verbose when deleting files\n';

Rm.prototype.next = check_next(do_docopt(function() {
    var self = this,
        deathstar = sys.getenv(self, 'DEATHSTAR'),
        nuke = "Detected nuclear rm -r /, aborting.";

    if (self.inited) {
        return next();
    }

    self.inited = true;
    self.retval = true;
    self.cliopts = optstr_parse(self.docopts['-o']);
    var files = self.docopts['<file>'];

    if (self.docopts['-r'] && files.indexOf('/auth') !== -1 && files.indexOf('/sys') !== -1) {
        /*
         * It's a safe bet somebody goofed up and an rm -r $SOMEVAR/* expanded
         * to rm -r /*
         *
         * You're welcome.
         */
        return self.exit(nuke);
    }
    if (self.docopts['-r'] && (!deathstar || !deathstar.length)) {
        var msg = "rm -r is VERY DANGEROUS and can wipe out all your cloud data with one command. To enable recursive removal, set the shell variable DEATHSTAR=1";
        return self.exit(msg);
    }
    if (files.length === 0) {
        if (!self.fds.stdin || self.fds.stdin instanceof Stdin) {
            return self.exit("Too few files specified");
        }
    } else {
        files.push(null);
        self._buffer = self._buffer.concat(files);
    }
    return next();

    function next() {
        self.unext({}, cef(self, function(file) {
            if (file === null) {
                return self.exit(self.retval);
            }
            var spath = isstring(file) ? file : isstring(file._path) ? file._path : null;
            if (!spath) {
                return self.exit("Invalid file specification: " + file.toString());
            }
            rmtree(spath, function(err) {
                if (err) {
                    self.retval = false;
                }
                return next();
            });
        }));
    }

    function rmtree(pathname, cb) {
        sys.lookup(self, pathname, self.cliopts, function(err, file) {
            if (err) {
                rmlog(err, pathname);
                return cb(err);
            }
            if (file.ident === "ramfs://root/" || file.ident === '/auth') {
                /*
                 * Complicated ways of shooting yourself in the head, like
                 * rm -r ..///../.././ and rm -r ././././../../*
                 * will hopefully get caught here.
                 */
                return self.exit(nuke);
            }
            if (!isrealdir(file) || !self.docopts['-r']) {
                return rmfile(pathname, cb);
            }
            sys.readdir(self, file, self.cliopts, function(err, files) {
                if (err) {
                    rmlog(err, pathname);
                    return cb(err);
                }
                var fnames = Object.keys(files);
                async.forEachSeries(fnames, function(fname, acb) {
                    var f = files[fname];
                    if (isrealdir(f)) {
                        rmtree(pathjoin(pathname, fname), function() {
                            return soguard(self, acb.bind(null, null));
                        });
                    } else {
                        rmfile(pathjoin(pathname, fname), function() {
                            return soguard(self, acb.bind(null, null));
                        });
                    }
                }, function(err) {
                    rmfile(pathname, cb);
                });
            });
        });
    }

    function rmfile(pathname, cb) {
        var pathname = pathname.replace(/\/+$/, ''),
            comps = pathsplit(pathname),
            last = comps[1],
            pdir = comps[0];
        sys.lookup(self, pdir, self.cliopts, function(err, dir) {
            if (err) {
                rmlog(err, pathname);
                return cb(err);
            }
            if (self.docopts['-n']) {
                rmlog(null, pathname);
                return cb(null, null);
            } else {
                sys.rm(self, dir, last, self.cliopts, function(err, res) {
                    rmlog(err, pathname);
                    return cb(err, res);
                });
            }
        });
    }
    function rmlog(err, pathname) {
        if (err) {
            self.retval = false;
            self.errmsg(err, pathname);
        } else {
            if (self.docopts['-v']) {
                self.errmsg("removed " + pathname);
            }
        }
    }
}));

Command.register("rm", Rm);

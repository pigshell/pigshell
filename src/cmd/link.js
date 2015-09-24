/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function LinkCmd(opts) {
    var self = this;

    LinkCmd.base.call(self, opts);
}

inherit(LinkCmd, Command);

LinkCmd.prototype.usage = 'link           -- make links\n\n' +
    'Usage:\n' +
    '    link [-o <opts>] [-b] <source> <target>\n' +
    '    link [-o <opts>] [-b] <source>... <directory>\n' +
    '    link [-o <opts>] [-b] <directory>\n' +
    '    link -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message\n' +
    '    -b           Link to the base of the file stack\n' +
    '    -o <opts>    Options to pass to lower layers\n';

LinkCmd.prototype.internalUsage = 'link           -- make links\n\n' +
    'Usage:\n' +
    '    link [-o <opts>] [-b] <file>...\n' +
    '    link <-h | --help>\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n';

LinkCmd.prototype.next = check_next(do_docopt(pathargs(function() {
    var self = this;

    if (self.inited) {
        return next();
    }

    self.inited = true;
    self.cliopts = optstr_parse(self.docopts['-o']);
    self.retval = true;

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
                tname = self.tname || basenamedir(spath);
            if (!spath) {
                return self.exit("Invalid file specification: " + file.toString());
            }

            makelink(fstack_top(self.tdir), self.tdirpath, tname, spath,
                function(err, res) {
                if (err) {
                    self.retval = false;
                    self.errmsg(err, res);
                }
                return next();
            });
        }));
    }

    function makelink(tdir, tdirpath, tname, srcpath, cb) {
        var u = URI.parse(srcpath);

        if (u.isAbsolute()) {
            var str = '<a href="';
            if (u.scheme() !== "http" && u.scheme() !== "https") {
                str += '" data-ident="' + srcpath + '">';
            } else {
                str += srcpath + '">';
            }
            str += "{{name}}</a>";
            return sys.link(self, tdir, str, tname, self.cliopts, cb);
        }
        fstat.call(self, srcpath, function(err, file) {
            if (err) {
                return cb(err, srcpath);
            }
            var str = self.docopts["-b"] ? fstack_base(file).getlink() :
                file.getlink();

            return sys.link(self, tdir, str, tname, self.cliopts, cb);
        });
    }
})));

Command.register("link", LinkCmd);

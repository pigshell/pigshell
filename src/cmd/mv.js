/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function pathargs(more) {
    return function() {
        var self = this,
            filenames = self.docopts['<file>'];
        if (filenames && filenames.length) {
            self.docopts['<file>'] = null;
            var target = filenames.pop();
            self.target = target;
            if (filenames.length === 1) {
                self.mode = 'single';
                self.source = filenames[0];
                filenames.push(null);
                self._buffer = self._buffer.concat(filenames);
            } else if (filenames.length === 0) {
                self.mode = 'multi';
                if (!self.fds.stdin || self.fds.stdin instanceof Stdin) {
                    return self.exit("Too few files specified");
                }
            } else {
                self.mode = 'multi';
                filenames.push(null);
                self._buffer = self._buffer.concat(filenames);
            }
            return more.apply(self, arguments);
        } else {
            return self.exit("No file arguments, should never get here");
        }
    };
}

function Mv(opts) {
    var self = this;

    Mv.base.call(self, opts);
}

inherit(Mv, Command);

Mv.prototype.usage = 'mv           -- move files\n\n' +
    'Usage:\n' +
    '    mv [-o <opts>] <source> <target>\n' +
    '    mv [-o <opts>] <source>... <directory>\n' +
    '    mv [-o <opts>] <directory>\n' +
    '    mv -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n';

Mv.prototype.internalUsage = 'mv           -- move files\n\n' +
    'Usage:\n' +
    '    mv [-o <opts>] <file>...\n' +
    '    mv <-h | --help>\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n';

Mv.prototype.next = check_next(do_docopt(pathargs(function() {
    var self = this;

    if (self.inited) {
        return next();
    }

    self.inited = true;
    self.cliopts = optstr_parse(self.docopts['-o']);
    self.retval = true;

    if (self.mode === 'single') {
        frename.call(self, self.source, self.target, function(err) {
            return self.exit(err);
        });
    } else {
        sys.lookup(self, self.target, self.cliopts, function(err, file) {
            if (err) {
                return self.exit(err, self.target);
            }
            return next();
        });
    }

    function next() {
        self.unext({}, cef(self, function(file) {
            if (file === null) {
                return self.exit(self.retval);
            }
            var spath = isstring(file) ? file : isstring(file._path) ? file._path : null;
            if (!spath) {
                return self.exit("Invalid file specification: " + file.toString());
            }
            frename.call(self, spath, self.target, function(err) {
                if (err) {
                    self.errmsg(err, spath);
                    self.retval = false;
                }
                return next();
            });
        }));
    }
})));

Command.register("mv", Mv);

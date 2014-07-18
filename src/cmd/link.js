/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Link(opts) {
    var self = this;

    Link.base.call(self, opts);
}

inherit(Link, Command);

Link.prototype.usage = 'link         -- make links\n\n' +
    'Usage:\n' +
    '    link <source_file> <target_file>\n' +
    '    link -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Link.prototype.next = check_next(do_docopt(function() {
    var self = this,
        src = self.docopts['<source_file>'],
        target = self.docopts['<target_file>'];

    function makelink(srcfile, destdir, name) {
        if (typeof destdir.link === 'function') {
            return sys.link(self, destdir, srcfile, name, {}, function(err) {
                if (err) {
                    return self.exit(err);
                }
                return self.exit(null, null);
            });
        }
        return self.exit(E('ENOSYS'), target);
    }

    sys.lookup(self, src, {}, function(err, srcfile) {
        if (err) {
            return self.exit(err);
        }
        sys.lookup(self, target, {}, function(err, dir) {
            if (!err) {
                return makelink(srcfile, dir, srcfile.name);
            }
            var comps = pathsplit(target),
                pdir = comps[0];

            sys.lookup(self, pdir, {}, function(err, dir) {
                if (!err) {
                    return makelink(srcfile, dir, srcfile.name);
                }
                return self.exit(E('ENOENT'), pdir);
            });
        });
    });
}));

Command.register("link", Link);

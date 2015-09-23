/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function LinkCmd(opts) {
    var self = this;

    LinkCmd.base.call(self, opts);
}

inherit(LinkCmd, Command);

LinkCmd.prototype.usage = 'link         -- make link\n\n' +
    'Usage:\n' +
    '    link <source> <target>\n' +
    '    link -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

LinkCmd.prototype.next = check_next(do_docopt(function() {
    var self = this,
        src = self.docopts['<source>'],
        target = self.docopts['<target>'],
        u = URI.parse(src);

    function makelink(str, destdir, name) {
        if (typeof destdir.link === 'function') {
            return sys.link(self, destdir, str, name, {}, function(err) {
                return self.exit(err);
            });
        }
        return self.exit(E('ENOSYS'), target);
    }

    function getdestdir(str) {
        sys.lookup(self, target, {}, function(err, dir) {
            if (err && err.code !== "ENOENT") {
                return self.exit(err, target);
            }
            if (!err) {
                if (isrealdir(dir)) {
                    return makelink(str, dir, basenamedir(src));
                } else {
                    return self.exit(E("EEXIST"), target);
                }
            }
            var comps = pathsplit(target),
                pdir = comps[0],
                name = comps[1];

            sys.lookup(self, pdir, {}, function(err, dir) {
                if (!err) {
                    return makelink(str, dir, name);
                }
                return self.exit(E('ENOENT'), pdir);
            });
        });
    }

    if (u.isAbsolute()) {
        var str = '<a href="';
        if (u.scheme() !== "http" && u.scheme() !== "https") {
            str += '" data-ident="' + src + '">';
        } else {
            str += src + '">';
        }
        str += "{{name}}</a>";
        return getdestdir(str);
    }

    sys.lookup(self, src, {}, function(err, srcfile) {
        if (err) {
            return self.exit(err, src);
        }
        var str = srcfile.getlink();
        return getdestdir(str);
    });
}));

Command.register("link", LinkCmd);

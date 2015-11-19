/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * TODO mount w/o arguments should display list of mounted filesystems
 */

function Mount(opts) {
    var self = this;

    Mount.base.call(self, opts);
}

inherit(Mount, Command);

Mount.prototype.usage = 'mount        -- mount filesystem\n\n' +
    'Usage:\n' +
    '    mount [-o <opts>] <uri> <dir>\n' +
    '    mount [-o <opts>] -t <fstype> <dir>\n' +
    '    mount [-h | --help]\n\n' +
    'Options:\n' +
    '   -h --help     Show this message.\n' +
    '   -t <fstype>   File system type\n' +
    '   -o <opts>     Mount options\n' +
    '   <uri>         URI to mount as root\n' +
    '   <dir>         Mountpoint\n';

Mount.prototype.next = check_next(do_docopt(function() {
    var self = this,
        dir = self.docopts['<dir>'],
        optstring = self.docopts['-o'] || "",
        uri = self.docopts['<uri>'],
        fstype = self.docopts['-t'],
        opts = optstr_parse(optstring);

    if (!dir) {
        var mounts = self.shell.ns.mountlist(),
            list = [];
        list = Object.keys(mounts).map(function(m) {
            var root = mounts[m].dir,
                optstr = JSON.stringify(mounts[m].opts),
                brstr = VFS.lookup_handler_name(root.fs.constructor) || 'unknown';
                
            brstr += (optstr !== "{}") ? "," + optstr : "";
            return sprintf("%s on %s (%s)", root.ident, m, brstr);
        });
        self.done = true;
        return self.output(list.join('\n') + '\n');
    }

    if (fstype) {
        loadhandler.call(self, fstype, function(err, res) {
            if (err) {
                return self.exit(err);
            }
            var handler = VFS.lookup_handler(fstype),
                rooturi = handler.rooturi ? handler.rooturi(opts) : null;
            if (!rooturi) {
                return self.exit(err);
            }
            mount_uri.call(self, rooturi, dir, opts, self.shell,
                function(err, res) {
                return self.exit(err);
            });
        });
    } else {
        mount_uri.call(self, uri, dir, opts, self.shell, function(err, res) {
            return self.exit(err);
        });
    }
}));

Command.register("mount", Mount);

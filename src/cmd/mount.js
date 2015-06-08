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
    '    mount [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Mount options\n' +
    '   <uri>         URI to mount as root\n' +
    '   <dir>         Mountpoint\n';

Mount.prototype.next = check_next(do_docopt(function() {
    var self = this,
        dir = self.docopts['<dir>'],
        optstring = self.docopts['-o'],
        uri = self.docopts['<uri>'],
        optlist = optstring ? optstring.split(',') : [],
        opts = {};

    if (!uri) {
        var mounts = self.shell.ns.mountlist(),
            list = [];
        list = Object.keys(mounts).map(function(m) {
            var root = mounts[m].dir,
                optstr = optstr_make(mounts[m].opts),
                brstr = root.fs.constructor.hname;
                
            brstr += optstr ? ',' + optstr : '';
            return sprintf("%s on %s (%s)", root.ident, m, brstr);
        });
        self.done = true;
        return self.output(list.join('\n') + '\n');
    }

    for (var i = 0; i < optlist.length; i++) {
        var opt = optlist[i],
            eqlist = opt.split('=');
        if (eqlist.length > 1) {
            opts[eqlist[0]] = eqlist.slice(1).join('=');
        } else {
            opts[eqlist[0]] = true;
        }
    }

    mount_uri.call(self, uri, dir, opts, self.shell, function(err, res) {
        return self.exit(err);
    });
}));

Command.register("mount", Mount);

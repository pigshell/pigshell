/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Umount(opts) {
    var self = this;

    Umount.base.call(self, opts);
}

inherit(Umount, Command);

Umount.prototype.usage = 'umount       -- unmount filesystem\n\n' +
    'Usage:\n' +
    '    umount <dir>\n' +
    '    umount -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '   <dir>         Mountpoint\n';

Umount.prototype.next = check_next(do_docopt(function() {
    var self = this,
        dir = self.docopts['<dir>'];

    return self.shell.ns.umount(dir, function(err, res) {
        return self.exit(err, res);
    });
}));

Command.register("umount", Umount);

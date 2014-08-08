/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Exit(opts) {
    var self = this;

    Exit.base.call(self, opts);
}

inherit(Exit, Command);

Exit.prototype.usage = 'exit         -- exit shell\n\n' +
    'Usage:\n' +
    '    exit [<exitval>]\n' +
    '    exit -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    <exitval>    Exit value.\n';

Exit.prototype.next = check_next(do_docopt(function() {
    var self = this;

    return self.shell.builtin_exit(self.docopts['<exitval>']);
}));

Command.register("exit", Exit);

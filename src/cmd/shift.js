/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Shift(opts) {
    var self = this;

    Shift.base.call(self, opts);
}

inherit(Shift, Command);

Shift.prototype.usage = 'shift        -- shift arguments\n\n' +
    'Usage:\n' +
    '    shift [<num>]\n' +
    '    shift -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    <num>        Number of positional arguments to shift [default: 1]\n';

Shift.prototype.next = check_next(do_docopt(function() {
    var self = this,
        num = self.docopts['<num>'] ? +self.docopts['<num>'] : 1;

    if (isNaN(num) || num < 0) {
        return self.exit("shift count out of range");
    } else {
        self.shell.builtin_shift(num);
        return self.exit();
    }
}));

Command.register("shift", Shift);

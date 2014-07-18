/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Clear(opts) {
    var self = this;

    Clear.base.call(self, opts);
}

inherit(Clear, Command);

Clear.prototype.usage = 'clear        -- clear screen\n\n' +
    'Usage:\n' +
    '    clear\n' +
    '    clear [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.';

Clear.prototype.next = check_next(do_docopt(function() {
    var self = this;
    self.shell.builtin_clear();
    return self.exit();
}));

Command.register("clear", Clear);

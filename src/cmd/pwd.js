/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Pwd(opts) {
    var self = this;

    Pwd.base.call(self, opts);
}

inherit(Pwd, Command);

Pwd.prototype.usage = 'pwd          -- present working directory\n\n' +
    'Usage:\n' +
    '    pwd\n' +
    '    pwd [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Pwd.prototype.next = check_next(do_docopt(function() {
    var self = this;
    self.done = true;
    return self.output(self.pwd() + '\n');
}));

Command.register("pwd", Pwd);

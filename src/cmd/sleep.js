/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Sleep(opts) {
    var self = this;

    Sleep.base.call(self, opts);
}

inherit(Sleep, Command);

Sleep.prototype.usage = 'sleep        -- sleep for a specified number of seconds\n\n' +
    'Usage:\n' +
    '    sleep <seconds>\n' +
    '    sleep -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Sleep.prototype.next = check_next(do_docopt(function() {
    var self = this;

    if (!isnumber(self.docopts['<seconds>'])) {
        return self.exit();
    }
    self.timerid = setTimeout(check_live(self.exit).bind(self), self.docopts['<seconds>'] * 1000);
}));

Sleep.prototype.kill = function(reason) {
    var self = this;

    if (self.timerid) {
        clearTimeout(self.timerid);
    }
    Sleep.base.prototype.kill.call(self, reason);
};

Command.register("sleep", Sleep);

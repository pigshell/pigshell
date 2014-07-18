/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Uname(opts) {
    var self = this;

    Uname.base.call(self, opts);
}

inherit(Uname, Command);

Uname.prototype.usage = 'uname        -- print operating system name\n\n' +
    'Usage:\n' +
    '    uname [-arsv]\n' +
    '    uname -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Uname.prototype.next = check_next(do_docopt(function() {
    var self = this,
        comps = [],
        pv = pigshell.version;

    self.done = true;

    if (self.docopts['-a']) {
        comps = ['Pigshell', pv.str, pv.git];
    } else {
        if (self.docopts['-s']) {
            comps.push('Pigshell');
        }
        if (self.docopts['-r']) {
            comps.push(pv.str);
        }
        if (self.docopts['-v']) {
            comps.push(pv.git);
        }
    }
    return self.output(comps.join(' ') + '\n');
}));

Command.register("uname", Uname);

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
    '    uname -n | -u\n' +
    '    uname -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -a           Behave as if all the options -rsv were specified.\n' +
    '    -r           Print operating system release.\n' +
    '    -s           Print operating system name.\n' +
    '    -v           Print git commit id of deployment.\n' +
    '    -n           Print site name.\n' +
    '    -u           Print site URL.\n';

Uname.prototype.next = check_next(do_docopt(function() {
    var self = this,
        comps = [],
        pv = pigshell.version;

    self.done = true;

    if (self.docopts["-n"]) {
        comps = [pigshell.site.name];
    } else if (self.docopts["-u"]) {
        comps = [pigshell.site.url];
    } else if (self.docopts['-a']) {
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

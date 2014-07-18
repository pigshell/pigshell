/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Cd(opts) {
    var self = this;

    Cd.base.call(self, opts);
}

inherit(Cd, Command);

Cd.prototype.usage = 'cd           -- change directory\n\n' +
    'Usage:\n' +
    '    cd <dir>\n' +
    '    cd [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Cd.prototype.next = check_next(do_docopt(function() {
    var self = this,
        dir = self.docopts['<dir>'];

    if (!dir) {
        dir = sys.getenv(self, 'HOME') ? sys.getenv(self, 'HOME')[0] : '/';
        dir = dir ? dir : '/';
    }

    self.chdir(dir, function(err, newdir) {
        if (err) {
            return self.exit(err, dir);
        }
        /*
         * Whole point of cd is to change parents' cwd, up to the first
         * shell which owns its own context i.e. not a -s or a function
         */
        var shell = self.shell;
        while (shell) {
            shell.cwd = self.cwd;
            if (shell === shell.shell ||
                !(shell.docopts['-s'] || shell.docopts['-f'])) {
                break;
            }
            shell = shell.shell;
        }
        return self.exit();
    });
}));

Command.register("cd", Cd);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Echo(opts) {
    var self = this;

    Echo.base.call(self, opts);
}

inherit(Echo, Command);

Echo.prototype.usage = 'echo         -- write arguments to standard output\n\n' +
    'Usage:\n' +
    '    echo [-n | -r] [<item>...]\n' +
    '    echo [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -n           Do not print trailing newline.\n' +
    '    -r           Raw mode. Copy arguments to stdout as a list\n';

Echo.prototype.next = check_next(do_docopt(function() {
    var self = this,
        items = (self.docopts['-n'] || self.docopts['-r']) ? self.opts.argv.slice(2) : self.opts.argv.slice(1);

    if (items.length === 0) {
        items = [''];
    }
    self.done = true;
    if (!self.docopts['-r'] && isstring(items[0])) {
        /* Assume everything's a string */
        var out = items.map(function(x) { return x.toString(); }).join(' ');
        if (!self.docopts['-n']) {
            out = out + '\n';
        }
        return self.output(out);
    }
    self.output(items);
}));

Command.register("echo", Echo);

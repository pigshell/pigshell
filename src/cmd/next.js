/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Next(opts) {
    var self = this;

    Next.base.call(self, opts);
}

inherit(Next, Command);

Next.prototype.usage = 'next         -- get next item from pipeline\n\n' +
    'Usage:\n' +
    '    next -h | --help\n' +
    '    next [-o <opts>] [<obj>]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n';

Next.prototype.next = check_next(do_docopt(function() {
    var self = this,
        cliopts = optstr_parse(self.docopts['-o']),
        obj = self.docopts['<obj>'] || self.fds.stdin;

    if (typeof obj.next !== 'function') {
        return self.exit("Object has no next() method");
    }
    proc.current(null);
    obj.next(cliopts, cef(self, function(res) {
        proc.current(self);
        if (res === null) {
            return self.exit();
        }
        self.done = true;
        var ret = res instanceof Array ? res[0] : res;
        return self.output(ret);
    }));
}));

Command.register("next", Next);

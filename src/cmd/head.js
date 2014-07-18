/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Head(opts) {
    var self = this;

    Head.base.call(self, opts);
    self.count = 0;
}

inherit(Head, Command);

Head.prototype.usage = 'head         -- display first few elements\n\n' +
    'Usage:\n' +
    '    head [-n <count>]\n' +
    '    head [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -n <count>   Number of items [default: 10]\n';

Head.prototype.next = check_next(do_docopt(function(item) {
    var self = this,
        max = +self.docopts['-n'];

    self.unext({}, cef(self, function(item) {
        if (item === null) {
            return self.exit();
        }
        if (++self.count >= max) {
            self.done = true;
        }
        return self.output(item);
    }));
}));

Command.register("head", Head);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Sum(opts) {
    var self = this;

    Sum.base.call(self, opts);
    self.counter = 0;
}

inherit(Sum, Command);

Sum.prototype.usage = 'sum          -- object count\n\n' +
    'Usage:\n' +
    '    sum [-e <exp>] [<obj>...]\n' +
    '    sum [-f <field>] [<obj>...]\n' +
    '    sum [-h | --help]\n\n' +
    'Options:\n' +
    '    -e <exp>     Sum up <exp> of all input objects where <exp> is a Javascript expression\n' +
    '    -f <field>   Specify field of object to sum\n' +
    '    -h --help    Show this message.\n';

Sum.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this,
        field = self.docopts['-f'],
        exp = self.docopts['-e'];

    if (self.inited === undefined) {
        self.inited = true;
        if (exp) {
            self.getfield = eval_getexp(exp);
        } else if (field) {
            self.getfield = eval_getfield(field, 0);
        }
        if (isstring(self.getfield)) {
            return self.exit(self.getfield);
        }
    }

    return next();

    function next() {
        self.unext({}, cef(self, function(item) {
            if (item === null) {
                self.done = true;
                return self.output(self.counter.toString() + '\n');
            }
            if (self.getfield !== undefined) {
                try {
                    var n = self.getfield(item);
                    if (isnumber(n)) {
                        self.counter += n;
                    }
                } catch(err) {
                }
            } else {
                self.counter++;
            }
            return next();
        }));
    }
})));

Command.register("sum", Sum);

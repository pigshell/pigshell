/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Expr(opts) {
    var self = this;

    Expr.base.call(self, opts);
}

inherit(Expr, Command);

Expr.prototype.usage = 'E            -- evaluate an expression\n\n' +
    'Usage:\n' +
    '    E [<arg>...]\n' +
    '    E -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    <arg>        Concatenate args and Javascript eval\n';

Expr.prototype.next = check_next(function() {
    var self = this,
        argv = self.opts.argv,
        argstr = argv.slice(1).join(' ');

    function usage() {
        self.done = false;
        return self.output(self.usage);
    }

    function exit(val) {
        self.done = val;
        return self.eof();
    }

    if (argv.length < 2) {
        return exit(true);
    }

    if (argv[1] === '-h' || argv[1] === '--help') {
        return usage();
    }
    var fstr = '"use strict";'+ argstr + ';',
        res;
    try {
        res = eval(fstr);
    } catch(err) {
        console.log(fstr);
        return self.exit('Eval error: ' + err.message);
    }
    self.done = true;
    return self.output(res);
});

Command.register("E", Expr);

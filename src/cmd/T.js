/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Test(opts) {
    var self = this;

    Test.base.call(self, opts);
}

inherit(Test, Command);

Test.prototype.usage2 = '%(cmd)s         -- test an expression\n\n' +
    'Usage:\n' +
    '    %(cmd)s (-a|-f|-d|-r|-w) <path>%(end)s\n' +
    '    %(cmd)s (-z|-n) <string>%(end)s\n' +
    '    %(cmd)s <string1> <op> <string2>%(end)s\n' +
    '    %(cmd)s <arg>%(end)s\n' +
    '    %(cmd)s [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    <path>       File to test.\n' +
    '    -a           File exists.\n' +
    '    -f           File exists and is a regular file.\n' +
    '    -d           File exists and is a directory.\n' +
    '    -r           File is readable.\n' +
    '    -w           File is writable.\n' +
    '    -z           String is empty.\n' +
    '    -n           String is non-empty.\n' +
    '    <op>         Can be =, !=, <, >, -eq, -ne, -lt, -le, -gt -ge.\n' +
    '    <arg>        Javascript eval <arg>\n';

Test.prototype.usage = sprintf(Test.prototype.usage2, { cmd: 'test', end: '' });

Test.prototype.next = check_next(function() {
    var self = this,
        argv = self.opts.argv,
        sq = argv[0] === '[',
        op = argv[1],
        e = false,
        fstr;

    function usage() {
        var u = sprintf(self.usage2,
            { cmd: argv[0], end: (argv[0] === '[') ? ' ]' : '' });
        self.done = false;
        return self.output(u);
    }

    function exit(val) {
        self.done = val;
        return self.eof();
    }

    if (sq) {
        if (argv[argv.length - 1] !== ']') {
            return usage();
        }
        argv.pop();
    }
    if (argv.length < 2) {
        return usage();
    }

    if (op === '-h' || op === '--help') {
        return usage();
    }

    if (argv.length === 4) {
        var s1 = argv[1],
            op = argv[2],
            s2 = argv[3],
            arithmap = {'-eq': '==', '-ne': '!=', '-lt': '<', '-le': '<=',
                '-gt': '>', '-ge': '>='},
            stringmap = {'=': '==', '!=': '!=', '<': '<', '>': '>'};

        if (stringmap[op] === undefined && arithmap[op] === undefined) {
            return usage();
        }

        if (arithmap[op]) {
            op = arithmap[op];
            if (!isnumber(s1) || !isnumber(s2)) {
                return self.exit('Arguments to arithmetic operator not numeric');
            }
        } else {
            op = stringmap[op];
        }
        fstr = '"use strict"; s1' + op + 's2;';
        try {
            e = eval(fstr);
        } catch(err) {
            return self.exit('Eval error: ' + err.message);
        }
        return exit(e);
    }

    if (argv.length === 2) {
        var fstr = '"use strict";!!(' + argv[1] + ');',
            res;
        try {
            res = eval(fstr);
        } catch(err) {
            return self.exit('Eval error: ' + err.message);
        }
        return exit(res);
        /* Not self.exit because 'false' is not really an error
         * and self.exit would print an error message */
    }

    var fileops = ['-a', '-f', '-d', '-r', '-w'],
        stringops = ['-z', '-n'];

    if (fileops.indexOf(op) != -1) {
        if (argv[2] === '') {
            return exit(false);
        }
        sys.lookup(self, argv[2], {}, function(err, res) {
            if (err) {
                return exit(err);
            }
            if (op === '-a') {
                e = true;
            } else if (op === '-f') {
                e = !isrealdir(res);
            } else if (op === '-d') {
                e = isrealdir(res);
            } else if (op === '-r') {
                e = res.readable;
            } else if (op === '-w') {
                e = res.writable;
            }
            return exit(e);
        });
    } else if (stringops.indexOf(op) != -1) {
        if (op === '-z') {
            e = (argv[2] === '');
        } else if (op === '-n') {
            e = (argv[2] !== '');
        }
        return exit(e);
    } else {
        return usage();
    }
});

Command.register("T", Test);
Command.register("test", Test);
Command.register("[", Test);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Docopt(opts) {
    var self = this;

    Docopt.base.call(self, opts);
}

inherit(Docopt, Command);

Docopt.prototype.usage = 'docopt       -- parse command line options\n\n' +
    'Usage:\n' +
    '   docopt <usage> [<arg>...]\n' +
    '   docopt -h | --help\n\n' +
    'Options:\n' +
    '   -h --help   Show this message.\n' +
    '   <usage>     Usage string for script\n' +
    '   <arg>       Positional argument to script\n';

Docopt.prototype.next = check_next(function() {
    var self = this,
        usage = self.opts.argv[1],
        args = self.opts.argv.slice(2);

    if (usage === "-h" || usage === "--help") {
        self.errmsg(self.usage);
        return self.exit();
    }
    if (self.opts.argv.length === 1) {
        return self.exit(self.usage);
    }

    var res = docopt(usage, {'argv': args}, usage);
    if (res[0] !== null) {
        self.errmsg(res[0]);
        self.done = false;
        return self.eof();
    }
    var varmap = res[1],
        varnames = Object.keys(varmap);

    for (var i = 0; i < varnames.length; i++) {
        var name = varnames[i],
            sname;
        if (name.match(/(^[0-9]+)|#|\*|\?/)) {
            continue;
        }
        sname = name.replace(/^-{1,2}/, '').replace(/^<(.*)>/, "$1"); 
        if (varmap[name] === null) {
            sys.putenv(self, sname, []);
            continue;
        }

        var value = (varmap[name] instanceof Array) ? varmap[name] : [varmap[name]];
        value = value.map(function(item) {
            if (item === true) {
                return 'true';
            } else if (item === false) {
                return 'false';
            } else if (item === null) {
                return '';
            } else {
                return item;
            }
        });
        sys.putenv(self, sname, value);
    }
    return self.exit();
});

Command.register("docopt", Docopt);

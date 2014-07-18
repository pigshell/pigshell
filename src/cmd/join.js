/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Join(opts) {
    var self = this;

    Join.base.call(self, opts);
    self.counter = 0;
}

inherit(Join, Command);

Join.prototype.usage = 'join         -- join two lists of objects\n\n' +
    'Usage:\n' +
    '    join -e <exp> <xfile> <yfile>\n' +
    '    join -h | --help\n\n' +
    'Options:\n' +
    '    -e <exp>     Inner join using <exp> as the join expression' + 
    '    -h --help    Show this message.\n';

function eval_getexp2(exp) {
    var ret;
    try {
        var fstr = '"use strict"; var getfield = function(x, y, self) { return (' + exp + ');};getfield;';
        ret = eval(fstr);
    } catch(err) {
        ret = 'Eval error: ' + err.message;
    }
    return ret;
}

Join.prototype.next = check_next(do_docopt(function() {
    var self = this;

    if (self.inited === undefined) {
        self.inited = true;

        var exp = self.docopts['-e'],
            x = self.docopts['<xfile>'],
            y = self.docopts['<yfile>'];

        if (!(x instanceof Command) || !(y instanceof Command)) {
            return self.exit("Invalid file object");
        }
        self.getfield = eval_getexp2(exp);
        if (isstring(self.getfield)) {
            return self.exit(self.getfield);
        }
        x.read({}, check_live(cef(self, function(xdata) {
            y.read({}, check_live(cef(self, function(ydata) {
                self.xdata = xdata;
                self.ydata = ydata;
                self.ix = 0;
                self.iy = 0;
                self.xmax = xdata.length;
                self.ymax = ydata.length;
                return next();
            })).bind(self));
        })).bind(self));
        return;
    }

    next();

    function next() {
        while (self.ix < self.xmax) {
            while (self.iy < self.ymax) {
                var x = self.xdata[self.ix],
                    y = self.ydata[self.iy];

                self.iy++;
                if (self.getfield(x, y, self)) {
                    return self.output($.extend(true, {}, x, y));
                }
            }
            self.iy = 0;
            self.ix++;
        }
        return self.exit();
    }
}));

Command.register("join", Join);

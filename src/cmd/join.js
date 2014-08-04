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
    '    join [-s] -e <exp> <xfile> <yfile>\n' +
    '    join [-s] -f <field> <xfile> <yfile>\n' +
    '    join -h | --help\n\n' +
    'Options:\n' +
    '    -e <exp>     Inner join using <exp> as a Boolean join expression\n' + 
    '    -f <field>   Inner join using contents of <field>\n' +
    '    -s           Inputs are sorted, <exp> is a sort-style compare function\n' +
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
            y = self.docopts['<yfile>'],
            field = self.docopts['-f'];

        if (!(x instanceof Command) || !(y instanceof Command)) {
            return self.exit("Invalid file object");
        }
        if (field) {
            if (self.docopts['-s']) {
                exp = vsprintf(
                    'x["%s"] === y["%s"] ? 0 : x["%s"] < y["%s"] ? -1 : 1',
                    [field, field, field, field]);
            } else {
                exp = vsprintf('x["%s"] === y["%s"]', [field, field]);
            }
        }
        self.getfield = eval_getexp2(exp);
        if (isstring(self.getfield)) {
            return self.exit(self.getfield);
        }
        if (!self.docopts['-s']) {
            self.next_func = next1;
            x.read({}, check_live(cef(self, function(xdata) {
                y.read({}, check_live(cef(self, function(ydata) {
                    self.xdata = xdata;
                    self.ydata = ydata;
                    self.ix = 0;
                    self.iy = 0;
                    self.xmax = xdata.length;
                    self.ymax = ydata.length;
                    return self.next_func();
                })).bind(self));
            })).bind(self));
        } else {
            self.next_func = next2;
            self.x = x;
            self.y = y;
            x.next({}, check_live(cef(self, function(curx) {
                self.curx = curx;
                y.next({}, check_live(cef(self, function(cury) {
                    self.cury = cury;
                    return self.next_func();
                })).bind(self));
            })).bind(self));
        }
        return;
    }

    return self.next_func();

    /* Inputs unknown, full blown read */
    function next1() {
        while (self.ix < self.xmax) {
            while (self.iy < self.ymax) {
                var x = self.xdata[self.ix],
                    y = self.ydata[self.iy];

                self.iy++;
                var cmp = self.getfield(x, y, self);
                if (cmp !== true && cmp !== false) {
                    return self.exit('<exp> should return boolean for unsorted join');
                }
                if (cmp === true) {
                    return self.output($.extend(true, {}, x, y));
                }
            }
            self.iy = 0;
            self.ix++;
        }
        return self.exit();
    }

    /* Inputs sorted, streaming join */
    function next2() {
        if (self.curx === null || self.cury === null) {
            return self.exit();
        }
        var cmp = self.getfield(self.curx, self.cury, self);
        if (!isnumber(cmp)) {
            return self.exit('<exp> should return number for sorted join');
        }
        if (cmp === 0) {
            var res = $.extend(true, {}, self.curx, self.cury);
            self.x.next({}, check_live(cef(self, function(curx) {
                self.curx = curx;
                self.y.next({}, check_live(cef(self, function(cury) {
                    self.cury = cury;
                    return self.output(res);
                })).bind(self));
            })).bind(self));
        } else if (cmp < 0) {
            self.x.next({}, check_live(cef(self, function(curx) {
                self.curx = curx;
                return self.next_func();
            })).bind(self));
        } else {
            self.y.next({}, check_live(cef(self, function(cury) {
                self.cury = cury;
                return self.next_func();
            })).bind(self));
        }
    }
}));

Command.register("join", Join);

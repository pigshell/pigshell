/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Sort(opts) {
    var self = this;

    Sort.base.call(self, opts);
    self.list = [];
    self.sort_type = undefined;
}

inherit(Sort, Command);

Sort.prototype.usage = 'sort         -- sort objects\n\n' +
    'Usage:\n' +
    '    sort [-r] [-n|-s] [-e <exp>] [<obj>...]\n' +
    '    sort [-r] [-n|-s] [-f <field>] [<obj>...]\n' +
    '    sort [-h | --help]\n\n' +
    'Options:\n' +
    '    -r           Reverse sort\n' +
    '    -n           Force numeric sort\n' +
    '    -s           Force string sort\n' +
    '    -e <exp>     Sort using <exp> of input objects where <exp> is a Javascript expression\n' +
    '    -f <field>   Specify field of object to sort\n' +
    '    -h --help    Show this message.\n';

Sort.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this,
        exp = self.docopts['-e'],
        field = self.docopts['-f'];

    if (self.inited === undefined) {
        self.inited = true;
        if (self.docopts['-s']) {
            self.sort_type = 'string';
            self.final_sort_type = 'string';
        } else if (self.docopts['-n']) {
            self.sort_type = 'numeric';
            self.final_sort_type = 'numeric';
        } else {
            self.sort_type = 'auto';
            self.final_sort_type = 'auto';
        }

        if (exp) {
            self.getfield = eval_getexp(exp);
        } else if (field) {
            self.getfield = eval_getfield(field, undefined);
        } else {
            self.getfield = function(item) { return item.toString(); };
        }
        if (isstring(self.getfield)) {
            return self.exit(self.getfield);
        }
        self.sortfunc = function(a, b) { return (a.field < b.field) ? -1 : ((a.field > b.field) ? 1 : 0); };
    }

    return next();

    function next() {
        self.unext({}, cef(self, process_item));
    }

    function process_item(item) {
        if (item === null) {
            if (self.list.length === 0) {
                return self.exit();
            }
            self.done = true;
            if (self.final_sort_type === 'numeric') {
                self.list = $.map(self.list, function(item, index) {
                    if (!isNaN(parseFloat(item.field))) {
                        return {field: parseFloat(item.field), obj: item.obj};
                    }
                });
            }
            var out = self.list.sort(self.sortfunc);
            if (self.docopts['-r']) {
                out = out.reverse();
            }
            out = $.map(out, function(item) { return item.obj; });
            return self.output(out);
        }
        try {
            var n = self.getfield(item);
            if (n !== undefined && n !== null) {
                if (self.sort_type === 'auto' && self.final_sort_type !== 'string') {
                    self.final_sort_type = isNaN(parseFloat(n)) ? 'string' : 'numeric';
                }
                self.list.push({field: n.toString(), obj: item});
            }
        } catch(err) {
        }
        return next();
    }
})));

Command.register("sort", Sort);

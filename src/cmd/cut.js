/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Cut(opts) {
    var self = this;

    Cut.base.call(self, opts);
}

inherit(Cut, Command);

Cut.prototype.usage = 'cut         -- retain specified fields of object\n\n' +
    'Usage:\n' +
    '    cut -f <fields> [<obj>...]\n' +
    '    cut -h | --help\n\n' +
    'Options:\n' +
    '    -f <fields>  Comma separated list of fields to select from object\n' + 
    '    <obj>        Object to process\n' +
    '    -h --help    Show this message.\n';

Cut.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this;

    if (self.inited === undefined) {
        self.inited = true;

        var fields = self.docopts['-f'];
        getcsl.call(self, fields, cef(self, function(res) {
            self.fields = res;
            return next();
        }));
        return;
    }

    next();

    function next() {
        self.unext({}, cef(self, function(item) {
            if (item === null) {
                return self.exit();
            }
            var obj = {};
            self.fields.forEach(function(el) {
                obj[el] = item[el];
            });
            return self.output(obj);
        }));
    }
})));

Command.register("cut", Cut);

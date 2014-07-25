/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Rename(opts) {
    var self = this;

    Rename.base.call(self, opts);
}

inherit(Rename, Command);

Rename.prototype.usage = 'rename       -- rename fields of object\n\n' +
    'Usage:\n' +
    '    rename -f <from> -t <to> [<obj>...]\n' +
    '    rename -h | --help\n\n' +
    'Options:\n' +
    '    -f <from>    Comma separated list of source field names\n' + 
    '    -t <to>      Comma separated list of target field names\n' + 
    '    <obj>        Object to process\n' +
    '    -h --help    Show this message.\n';

Rename.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this;

    if (self.inited === undefined) {
        self.inited = true;

        var src = self.docopts['-f'],
            dst = self.docopts['-t'];

        getcsl.call(self, src, cef(self, function(res) {
            self.srcfields = res;
            getcsl.call(self, dst, cef(self, function(res) {
                self.dstfields = res;
                if (self.srcfields.length !== self.dstfields.length) {
                    return self.exit("Number of source fields different from destination fields");
                }
                return next();
            }));
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
            for (var el in item) {
                var i = self.srcfields.indexOf(el);
                if (i === -1) {
                    obj[el] = item[el];
                } else {
                    obj[self.dstfields[i]] = item[el];
                }
            }
            return self.output(obj);
        }));
    }
})));

Command.register("rename", Rename);

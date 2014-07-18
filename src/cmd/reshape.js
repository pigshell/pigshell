/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Reshape(opts) {
    var self = this;

    Reshape.base.call(self, opts);
}

inherit(Reshape, Command);

Reshape.prototype.usage = 'reshape      -- reshape from wide to long\n\n' +
    'Usage:\n' +
    '    reshape -r <fields> -f <keyfield> -v <valfield> [<obj>...]\n' +
    '    reshape -c <fields> -f <keyfield> -v <valfield> [<obj>...]\n' +
    '    reshape -h | --help\n\n' +
    'Options:\n' +
    '    <obj>          Object to process\n' +
    '    -r <fields>    Fields to be retained\n' +
    '    -c <fields>    Fields to be "condensed"\n' +
    '    -f <keyfield>  New field to store condensed field name\n' +
    '    -v <valfield>  New field to store value\n' +
    '    -h --help      Show this message.\n';

Reshape.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this,
        keyfield = self.docopts['-f'],
        valfield = self.docopts['-v'];

    if (self.inited === undefined) {
        self.inited = true;

        var fields = self.docopts['-r'] || self.docopts['-c'];
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
            var keys = Object.keys(item).filter(function(k) {
                    return item.hasOwnProperty(k);
                }),
                proto = {},
                rest = keys.filter(function(k) {
                    return self.fields.indexOf(k) === -1;
                }),
                objs;
            if (self.docopts['-r']) {
                objs = condense(self.fields, rest, item);
            } else {
                objs = condense(rest, self.fields, item);
            }
            return self.output(objs);
        }));
    }

    function condense(keep, c, item) {
        var proto = {};
        keep.forEach(function(k) {
            proto[k] = item[k];
        });
        var objs = c.map(function(k) {
            var o = $.extend(true, {}, proto);
            o[keyfield] = k;
            o[valfield] = item[k];
            return o;
        });
        return objs;
    }
})));

Command.register("reshape", Reshape);

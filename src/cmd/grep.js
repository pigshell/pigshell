/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Grep(opts) {
    var self = this;

    Grep.base.call(self, opts);
    self.matched = false;
}

inherit(Grep, Command);

Grep.prototype.usage = 'grep         -- object pattern searcher\n\n' +
    'Usage:\n' +
    '    grep [-iv] [-f <field>] <regex> [<obj>...]\n' +
    '    grep [-v] -e <expr> [<obj>...]\n' +
    '    grep -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -f <field>   Specify field of object\n' +
    '    <regex>      Javascript regular expression\n' +
    '    -e <expr>    Javascript expression, e.g. "x.attr == 10"\n' +
    '    -v           Invert sense of expression\n' +
    '    -i           Case-insensitive match\n';

Grep.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this,
        exp = self.docopts['-e'];

    if (self.inited === undefined) {
        self.inited = true;
        if (self.docopts['<regex>']) {
            var opts = self.docopts['-i'] ? 'i' : '',
                re = new RegExp(self.docopts['<regex>'], opts),
                field = self.docopts['-f'],
                getfield;
            if (field) {
                self.getfield = eval_getfield(field, undefined);
                if (isstring(self.getfield)) {
                    return self.exit(self.getfield);
                }
                self.filter = function(x) {
                    var n = self.getfield(x);
                    if (n !== undefined) {
                        return re.test(n.toString());
                    } else {
                        return false;
                    }
                };
            } else {
                self.filter = function(x) {
                    return re.test(x.toString());
                };
            }
        }
        if (self.docopts['-e']) {
            self.filter = eval_getexp('!!(' + exp + ')');
            if (isstring(self.filter)) {
                return self.exit(self.filter);
            }
        }
        if (self.docopts['-v']) {
            self.filter = function(f) { return function(item) { return !f(item); };}(self.filter);
        }
        self._linebuffer = [];
        self._partline = '';
    }
    return next();

    function next() {
        if (self._linebuffer.length) {
            return process_item(self._linebuffer.shift());
        }
        self.unext({}, cef(self, function(res) {
            update_line_buffer.call(self, res, function() {
                return next();
            });
        }));
    }

    function process_item(item) {
        if (item === null) {
            self.done = self.matched ? true : 'No match';
            return self.eof();
        }

        var m = false;
        try {
            if (self.filter(item)) {
                self.matched = m = true;
            }
        } catch(err) {
            self.errmsg('Caught error: ' + err.message);
        }
        if (m) {
            return self.output(item);
        }
        return soguard(self, next);
    }
})));


function update_line_buffer(res, cb) {
    var self = this;
    if (!(res instanceof Array)) {
        res = [res];
    }
    function makelines(str) {
        var lines = (self._partline + str).split('\n'),
            last = lines.pop(),
        lines = lines.map(function(m) { return m + '\n'; });
        self._partline = last;
        self._linebuffer = self._linebuffer.concat(lines);
    }
    async.forEachSeries(res, function(item, acb) {
        if (isstring(item)) {
            makelines(item);
        } else if (item instanceof Blob) {
            to('text', item, {}, function(err, res) {
                if (err) {
                    return self.exit(err);
                }
                makelines(res);
                return soguard(self, acb.bind(null, null));
            });
            return;
        } else {
            if (self._partline) {
                self._linebuffer.push(self._partline);
                self._partline = '';
            }
            self._linebuffer.push(item);
        }
        return soguard(self, acb.bind(null, null));
    },
    function(err) {
        return cb();
    });
}

Command.register("grep", Grep);

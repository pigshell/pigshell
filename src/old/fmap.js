function Fieldmap(opts) {
    var self = this;

    Fieldmap.base.call(self);
    self.opts = opts;
    self.matched = false;
    self.more_handler(self.more_next.bind(self));
    self.input_handler(self.process_file.bind(self));
}

inherit(Fieldmap, Command);

Fieldmap.prototype.usage = 'fmap         -- map object fields to new names\n\n' +
    'Usage:\n' +
    '    fmap [-a] -s <src> -t <target> [<file>...]\n' +
    '    fmap [-a] -e <exp> -t <target> [<file>...]\n' +
    '    fmap -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -s <src>     Comma-separated list of source fields.\n' +
    '    -e <exp>     Javascript expression, e.g. "x.field * 2"\n' +
    '    -t <target>  Target field to be added to object.\n' +
    '    -a           Add target field to original object.\n';

Fieldmap.prototype.more_next = check_live(do_docopt(fileargs(function() {
    var self = this;

    if (self.inited === undefined) {
        var srcs = self.docopts['-s'] ? self.docopts['-s'].split(',') : [],
            target = self.docopts['-t'],
            exp = self.docopts['-e'];
        self.inited = true;
        self.getfields = [];

        if (exp) {
            self.exp = eval_getexp(exp);
            if (isstring(self.exp)) {
                return self.exit(self.exp);
            }
        }
        if (srcs.length) {
            for (var i = 0; i < srcs.length; i++) {
                var gf = eval_getfield(srcs[i]);
                if (isstring(gf)) {
                    return self.exit(gf);
                }
                self.getfields.push(gf);
            }
        }
    }
    return self.more();
})));

Fieldmap.prototype.process_file = check_live(function(item) {
    var self = this;

    if (item === null) {
        return self.exit();
    }
    if (self.exp !== undefined) {
        try {
            var res = self.exp(item);
            if (res !== undefined) {
                if (self.docopts['-a']) {
                    item[self.docopts['-t']] = res;
                    self.output(item);
                    return self.more_next();
                }
                var c = $.extend({}, true, item);
                c[self.docopts['-t']] = res;
                self.output(c);
            }
        } catch(err) {
        }
        return self.more_next();
    }
    for (var i = 0; i < self.getfields.length; i++) {
        var res = self.getfields[i](item);
        if (res !== undefined) {
            if (self.docopts['-a']) {
                item[self.docopts['-t']] = res;
                self.output(item);
                break;
            }
            var c = $.extend({}, true, item);
            c[self.docopts['-t']] = res;
            self.output(c);
            break;
        }
    }
    return self.more_next();
});

Command.register("fmap", Fieldmap);

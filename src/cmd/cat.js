/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Cat(opts) {
    var self = this;

    Cat.base.call(self, opts);
    self.cliopts = {};
}

inherit(Cat, Command);

Cat.prototype.usage = 'cat          -- concatenate and print files\n\n' +
    'Usage:\n' +
    '    cat -h | --help\n' +
    '    cat [-o <opts>] [<file>...]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -o <opts>    Options to pass to lower layers\n';

Cat.prototype.next = check_next(do_docopt(fileargs(function() {
    var self = this;

    if (self.inited === undefined) {
        self.inited = true;
        self.cliopts = optstr_parse(self.docopts['-o']);
    }
    self.unext({}, cef(self, function(file) {
        if (file === null) {
            return self.exit();
        }
        if (typeof file.read === 'function') {
            sys.read(self, file, self.cliopts, function(err, cdata) {
                if (err) {
                    return self.exit(err, file.name);
                }
                return self.output(cdata);
            });
        } else {
            return self.output(file);
        }
    }));
})));

Command.register("cat", Cat);

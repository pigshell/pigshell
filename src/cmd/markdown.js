/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Markdown(opts) {
    var self = this;

    Markdown.base.call(self, opts);
    self.str = '';
}

inherit(Markdown, Command);

Markdown.prototype.usage = 'markdown     -- format and print markdown files\n\n' +
    'Usage:\n' +
    '    markdown [<file>...]\n' +
    '    markdown -h | --help\n';

Markdown.prototype.next = check_next(do_docopt(fileargs(function(file) {
    var self = this;

    next();

    function next() {
        self.unext({}, cef(self, function(file) {
            if (file === null) {
                if (self.mode === 'string') {
                    self.done = true;
                    return self.output({div: $('<div class="pmarkdown"/>').html(marked(self.str))});
                } else {
                    return self.exit();
                }
            }
            if (typeof file.read === 'function') {
                self.mode = 'file';
                sys.read(self, file, {}, function(err, res) {
                    if (err) {
                        return self.exit(err, file.name);
                    }
                    to('text', res, {}, function(err, res) {
                        if (err) {
                            return self.exit(err, file.name);
                        }
                        return self.output({div:$('<div class="pmarkdown"/>').html(marked(res))});
                    });
                });
            } else if (self.mode !== 'file') {
                self.mode = 'string';
                to('text', file, {}, function(err, res) {
                    if (err) {
                        return self.exit(err);
                    }
                    self.str += res;
                    return next();
                });
            } else {
                return self.exit(E('ENOSYS'), file.name);
            }
        }));
    }
})));

Command.register("markdown", Markdown);

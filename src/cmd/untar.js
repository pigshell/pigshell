/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Tar(opts) {
    var self = this;

    Tar.base.call(self, opts);
}

inherit(Tar, Command);

Tar.prototype.usage = 'untar        -- extract tar file to current directory\n\n' +
    'Usage:\n' +
    '    untar <source_file>\n' +
    '    untar -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Tar.prototype.next = check_next(do_docopt(function() {
    var self = this,
        src = self.docopts['<source_file>'],
        cwd = self.getcwd();

    sys.lookup(self, src, {}, function(err, srcfile) {
        if (err) {
            return self.exit(err);
        }
        untar(srcfile, cwd, {context: self}, function(err, res) {
            return self.exit(err);
        });
    });
}));

Command.register("untar", Tar);

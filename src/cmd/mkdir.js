/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Mkdir(opts) {
    var self = this;

    Mkdir.base.call(self, opts);
}

inherit(Mkdir, Command);

Mkdir.prototype.usage = 'mkdir        -- make directory\n\n' +
    'Usage:\n' +
    '    mkdir <dir>...\n' +
    '    mkdir -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Mkdir.prototype.next = check_next(do_docopt(function() {
    var self = this,
        dirs = self.docopts['<dir>'];

    async.forEachSeries(dirs, function(dirname, lcb) {
        var pathComponents = pathsplit(dirname),
            filename = pathComponents[1],
            parentDir = pathComponents[0];

        sys.lookup(self, parentDir, {}, function(err, dir) {
            if (err) {
                return self.exit(err, dirname);
            }
            sys.mkdir(self, dir, filename, {}, function(err, newDir) {
                if (err) {
                    return self.exit(err, dirname);
                }
                return lcb(null);
            });
        });
    }, function(err) {
        return self.exit(null, null);
    });
}));

Command.register("mkdir", Mkdir);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function MD5(opts) {
    var self = this;

    MD5.base.call(self, opts);
    self.hash = null;
}

inherit(MD5, Command);

MD5.prototype.usage = 'md5          -- compute MD5 checksum\n\n' +
    'Usage:\n' +
    '    md5 [-s <str>]\n' +
    '    md5 [<file>...]\n' +
    '    md5 [-h | --help]\n\n' +
    'Options:\n' +
    '    -s <str>     MD5 of string\n' +
    '    -h --help    Show this message.\n';

MD5.scripts = [
    "extra/crypto-js/core.js",
    "extra/crypto-js/md5.js",
    "extra/crypto-js/lib-typedarrays.js"
    ];

MD5.prototype.next = check_next(loadscripts(do_docopt(fileargs(function() {
    var self = this,
        str = self.docopts['-s'];

    if (self.inited === undefined) {
        self.inited = true;
        if (str) {
           var hash = CryptoJS.MD5(str);
           self.done = true;
           return self.output(hash.toString() + '\n');
        }
        self.hash = CryptoJS.algo.MD5.create();
    }

    next();

    function next() {
        self.unext({}, cef(self, process_item));
    }
    function process_item(item) {
        if (item === null) {
            self.done = true;
            var hash = self.hash.finalize();
            return self.output(hash.toString());
        }
        if (typeof item.read === 'function') {
            fproc.call(self, item, {}, function(chunk, range, acb) {
                to('arraybuffer', chunk, {}, function(err, res) {
                    if (err) {
                        return self.exit(err, item.name);
                    }
                    var word_array = CryptoJS.lib.WordArray.create(res);
                    self.hash.update(word_array);
                    return acb(null);
                });
            }, function() {
                return next();
            });
        } else {
            to('arraybuffer', item, {}, function(err, res) {
                if (err) {
                    return self.exit(err);
                }
                var word_array = CryptoJS.lib.WordArray.create(res);
                self.hash.update(word_array);
                return next();
            });
        }
    }
}))));

Command.register("md5", MD5);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function To(opts) {
    var self = this;

    To.base.call(self, opts);
    self.hash = null;
    self.tbuffer = [];
}

inherit(To, Command);

To.prototype.usage = 'to           -- convert to type\n\n' +
    'Usage:\n' +
    '    to [-g] [-m <mime>] <type> [<obj>...]\n' +
    '    to [-h | --help]\n\n' +
    'Options:\n' +
    '    <type>        Destination type: text, blob, canvas, arraybuffer\n' +
    '    -g            Gather all input and convert in one shot\n' +
    '    -m <mime>     Set blob\'s mime type\n' + 
    '    -h --help     Show this message.\n';

To.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this,
        dtype = self.docopts['<type>'] || 'text',
        valid = ["text", "blob", "canvas", "arraybuffer"],
        opts = self.docopts['-m'] ? {mime: self.docopts['-m']} : {};

    if (self.inited === undefined) {
        self.inited = true;
        if (valid.indexOf(dtype) == -1) {
            return self.exit("Invalid destination type");
        }
        self.dtype = dtype;
        self.ctype = self.docopts['-g'] ? 'blob': dtype;
    }

    return next();

    function next() {
        self.unext({}, cef(self, process_item));
    }

    function process_item(item) {
        if (item === null) {
            if (self.docopts['-g']) {
                var blob = new Blob(self.tbuffer);
                to(self.dtype, blob, opts, function(err, data) {
                    if (err) {
                        return self.exit(err);
                    }
                    self.done = true;
                    return self.output(data);
                });
                return;
            } else {
                return self.exit();
            }
        }
        to(self.ctype, item, opts, function(err, res) {
            if (err) {
                return self.exit(err);
            }
            if (self.docopts['-g']) {
                self.tbuffer.push(res);
                return next();
            } else {
                return self.output(res);
            }
        });
    }
})));

Command.register("to", To);

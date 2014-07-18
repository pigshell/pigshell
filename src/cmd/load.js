/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * TODO Load from file. URLs will be handled automatically.
 */

function Load(opts) {
    var self = this;

    Load.base.call(self, opts);
}

inherit(Load, Command);

Load.prototype.usage = 'load         -- load external javascript\n\n' +
    'Usage:\n' +
    '    load [-Fn] [<url>...]\n' +
    '    load [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -F           Load again, even if script is already loaded\n' +
    '    -n           Avoid caching script\n';

Load.prototype.next = check_next(do_docopt(function() {
    var self = this,
        url = self.docopts['<url>'],
        opts = {'force': self.docopts['-F'], 'nocache': self.docopts['-n']},
        scriptlist = [];

    if (!url || url.length === 0) {
        $('script').each(function() {
            if (this.src) {
                scriptlist.push(this.src.toString());
            }
        });
        self.done = true;
        return self.output(scriptlist.join('\n'));
    }

    loadjs(url, opts, function(err, res) {
        if (err) {
            return self.exit(err);
        }
        return self.exit();
    });
}));

Command.register("load", Load);

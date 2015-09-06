/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Print(opts) {
    var self = this;

    Print.base.call(self, opts);
}

inherit(Print, Command);

Print.prototype.usage = 'printf       -- formatted output\n\n' +
    'Usage:\n' +
    '    printf <format> [<obj>...]\n' +
    '    printf -j [<obj>...]\n' +
    '    printf -s <format> [<arg>...]\n' +
    '    printf [-h | --help]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -j           Print JSON representation of object\n' +
    '    -s           String arguments, similar to sprintf\n' +
    '    <format>     Format string, e.g. "%(name)20s %(size)d\\n"\n';

Print.prototype.next = check_next(do_docopt(objargs(function() {
    var self = this;

    if (self.docopts['-s']) {
        var out;
        try {
            out = vsprintf(self.docopts['<format>'], self.docopts['<arg>']);
        } catch(err) {
            return self.exit('Caught error: ' + err.toString());
        }
        self.done = true;
        return self.output(out);
    }

    next();

    function next() {
        self.unext({}, cef(self, function(item) {
            if (item === null) {
                return self.exit();
            }

            if (self.docopts['<format>']) {
                var out;
                try {
                    out = sprintf(self.docopts['<format>'], item);
                } catch(err) {
                    self.errmsg('Caught error: ' + err.toString());
                    return next();
                }
                return self.output(out);
            } else {
                if (item instanceof File || (item._path && item.fs)) {
                    return self.output(printstack(item));
                } else {
                    return self.output(JSON.stringify(item, null, 4));
                }
            }
        }));
    }

    function printfile(file) {
        var f = {},
            avoid = ["_lfile", "_ufile", "files", "data", "fs", "dotmeta"];
        for (var m in file) {
            if (avoid.indexOf(m) === -1) {
                f[m] = file[m];
            }
        }
        if (file.files) {
            f.files = Object.keys(file.files);
        /*
            f.files = {};
            for (var f1 in file.files) {
                f.files[f1] = { "__id": file.files[f1]["__id"] };
            }
        */
        }
        f.fs = {};
        mergeattr(f.fs, file.fs, ["opts", "uri"]);
        return JSON.stringify(f, null, 4);
    }

    function printstack(file) {
        var f = fstack_base(file),
            strlist = [];
        while (f) {
            strlist.push(printfile(f));
            f = f._ufile;
        }
        return strlist.join("\n");
    }
})));

Command.register("printf", Print);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Errtest(opts) {
    var self = this;

    Errtest.base.call(self, opts);
    self.count = 0;
}

inherit(Errtest, Command);

Errtest.prototype.usage = 'errtest      -- error tester\n\n' +
    'Usage:\n' +
    '    errtest [-n <max>] -i <tnum> [<file>...]\n' +
    '    errtest -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -n <max>     Max stdin items to read before barfing [default: 3]\n';

/*
 * Test cases:
 *
 * errtest -i 1
 * (should go boom, exception reported on shell, command failed with "red" status, console should show exception)
 *
 * errtest -i 2
 * (type 1 <enter>, 2 <enter>, 3.. by should go boom at 4)
 *
 * (on freshly loaded system)
 * ls | errtest -i 2
 * (should go boom)
 *
 * cd /doc; ls | errtest -i 3
 * (should go boom after printing out 3 files)
 *
 * i=1; while T $i -lt 500; do echo $i; sleep 0.2; i=$(E $i + 1); done
 * ^B
 * errtest -i 4
 * (should go boom. Repeat multiple times to ensure that it is only errtest
 * which goes boom and not any commands in the loop above)
 */

Errtest.prototype.next = check_next(do_docopt(fileargs(function() {
    var self = this,
        tnum = +self.docopts['<tnum>'],
        max = +self.docopts['-n'],
        foo;

    if (isNaN(tnum)) {
        return self.exit();
    }
    switch(tnum) {
        case 1:
            self.errmsg("Boom 1!");
            foo.bar();
            return self.exit();
        case 2:
            self.unext({}, cef(self, function(file) {
                if (self.count < max) {
                    self.count++;
                    return self.output(file);
                } else {
                    self.errmsg("Boom 2!");
                    foo.bar();
                    return self.exit();
                }
            }));
            break;
        case 3:
            self.unext({}, cef(self, function(file) {
                if (file === null) {
                    return self.exit();
                }
                if (typeof file.read === 'function') {
                    sys.read(self, file, self.cliopts, function(err, cdata) {
                        if (self.count > max) {
                            self.errmsg("Boom 3!");
                            foo.bar();
                            return self.exit();
                        }
                        self.count++;
                        if (err) {
                            return self.exit(err, file.name);
                        }
                        return self.output(cdata);
                    });
                } else {
                    return self.output(file);
                }
            }));
            break;
        case 4:
            var str = 'Boom! One day your car goes Boom!',
                blob = new Blob([str]);
            to('test', blob, {setcur: true, timeout: 1}, cef(self, function(txt) {
                self.errmsg("Boom 4!");
                foo.bar();
                return self.exit();
            }));
            break;
        default:
            self.errmsg("Unknown option");
            return self.exit();
    }
})));
Command.register("errtest", Errtest);

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Timestamp(opts) {
    var self = this;

    Timestamp.base.call(self, opts);
}

inherit(Timestamp, Command);

Timestamp.prototype.usage = 'date         -- display date and time\n\n' +
    'Usage:\n' +
    '    date [-t <string>] [-f <format>] [-v <delta>]\n' +
    '    date -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -f format    Output format [default: ddd MMM D HH:mm:ssZ YYYY]\n' +
    '    -t <string>  String to be parsed as a date\n' +
    '    -v <delta>   Time to add or subtract from the current time. ' +
    'Format is [-]<#><s|m|h|d|M|y>\n';

Timestamp.prototype.next = check_next(do_docopt(function() {
    var self = this,
        date = null,
        indate = self.docopts['-t'],
        time = self.docopts['-v'];
    try {
        if (indate !== false) {
            if (isnumber(indate)) {
                date = moment.unix(parseInt(indate, 10));
            } else {
                date = moment(indate);
            }
        } else {
            date = moment();
        }
    } catch(err) {
        return self.exit(err.message);
    }
    if (!date.isValid()) {
        return self.exit("Invalid date specified: " + indate);
    }
    self.done = true;
    if (self.docopts['-v'] !== false) {
        var quant = parseInt(time.match(/-*[0-9]+/)[0], 10);
        var unit = time.match(/[smhdMy]/)[0];
        date.add(unit, quant);
    }
    if (self.docopts['-f'] === 'u') {
        return self.output(date.unix().toString());
    } else {
        return self.output(date.format(self.docopts['-f']));
    }
}));

Command.register("date", Timestamp);

function Mailto(opts) {
    var self = this;

    Mailto.base.call(self);
    self.opts = opts;
    self.more_handler(self.next.bind(self));
    self.input_handler(self.input_next.bind(self));
    self.body = [];
}

inherit(Mailto, Command);

Mailto.prototype.usage = 'mailto       -- send email\n\n' +
    'Usage:\n' +
    '    mailto [-s <subject>] [<address>...]\n' +
    '    mailto -h | --help\n\n' +
    'Options:\n' +
    '    -s <subject>   Message subject\n' +
    '    <to>           Email address\n' + 
    '    <cc>           Cc list\n' +
    '    -h --help      Show this message.\n';

Mailto.prototype.next = check_live(do_docopt(function() {
    var self = this,
        addrs = self.docopts['<address>'];

    if (self.inited === undefined) {
        self.inited = true;
        for (var i = 0; i < addrs.length; i++) {
            if (!isValidEmailAddress(addrs[i])) {
                return self.exit("Invalid email address: " + addrs[i]);
            }
        }
    }
    return self.more();
}));

Mailto.prototype.input_next = check_live(function(item) {
    var self = this,
        addrs = self.docopts['<address>'],
        subject = self.docopts['-s'],
        body = self.body.join('\n');

    if (item === null) {
        var mailto,
            body = self.body.join('\n');

        mailto = "mailto:";
        if (addrs.length) {
            mailto += addrs.join(',');
        }
        mailto += '?';
        if (subject) {
            mailto += "subject=" + encodeURIComponent(subject);
        }
        if (body.length > 2000) {
            mailto += "&body=" + encodeURIComponent("Mail body too long; cut and paste content manually");
        } else {
            mailto += "&body=" + encodeURIComponent(body);
        }
        window.open(mailto);
        return self.exit();
    }
    if (isstring(item)) {
        self.body.push(item);
        return self.more();
    } else {
        return self.exit("Only text data can be embedded in email body");
    }
});

Command.register("mailto", Mailto);

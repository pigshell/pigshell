function Open(opts) {
    var self = this;

    Open.base.call(self);
    self.opts = opts;
    self.more_handler(self.next.bind(self));
}

inherit(Open, Command);

Open.prototype.usage = 'open         -- open file in native website\n\n' +
    'Usage:\n' +
    '    open <file>\n' +
    '    open -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Open.prototype.next = check_live(do_docopt(function() {
    var self = this;

    self.lookup(self.docopts['<file>'], {}, function(err, file) {
        if (err) {
            return self.exit(err, self.docopts['<file>']);
        }
        if (!file.homeUrl) {
            return self.exit(E('ENOURL'), file);
        }
        window.open(file.homeUrl);
        return self.exit();
    });
}));

Command.register("open", Open);

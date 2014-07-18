function Screenshot(opts) {
    var self = this;

    Screenshot.base.call(self);
    self.opts = opts;
    self.more_handler(self.next.bind(self));
}

inherit(Screenshot, Command);

Screenshot.prototype.usage = 'screenshot   -- take screenshot\n\n' +
    'Usage:\n' +
    '    screenshot <DOM_ID>\n' +
    '    screenshot -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    DOM_ID       DOM ID of element to capture.\n';

Screenshot.prototype.next = check_live(do_docopt(function() {
    var self = this;

    var elem = $('#' + self.docopts['<DOM_ID>']);
    if (elem.length === 0) {
        return self.exit(E('ENOENT'), self.docopts['<DOM_ID>']) ;
    } else {
        html2canvas(elem, {
            onrendered: function(canvas) {
                self.done = true;
                return self.output(canvas);
            },
            proxy: '',
            useCORS: true,
            allowTaint: true
        });
    }
}));

Command.register("screenshot", Screenshot);

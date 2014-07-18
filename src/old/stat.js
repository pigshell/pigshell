function Stat(opts) {
    var self = this;

    Stat.base.call(self);
    self.opts = opts;
    self.more_handler(self.more_next.bind(self));
    self.input_handler(self.process_file.bind(self));
}

inherit(Stat, Command);

Stat.prototype.usage = 'stat         -- show file properties\n\n' +
    'Usage:\n' +
    '    stat [<file>...]\n' +
    '    stat -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n';

Stat.prototype.more_next = check_live(do_docopt(fileargs(function() {
    var self = this;
    return self.more();
})));

Stat.prototype.process_file = check_live(function(item) {
    var self = this;

    if (item === null) {
        return self.exit();
    }
    // Deep copy
    var newObject = $.extend(true, {}, item);
    cleanFile(newObject);
    var string = prettyPrint(newObject, self.isatty());
    return self.output(self.isatty() ?
        {div: $('<div class="stat"/>').html(string)}: string.split('\n'));
});

Command.register("stat", Stat);

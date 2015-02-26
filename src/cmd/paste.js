/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Paste(opts) {
    var self = this;

    Paste.base.call(self, opts);
    self.obuffer = [];
}

inherit(Paste, Command);

Paste.prototype.usage = 'paste        -- editable HTML paste target\n\n' +
    'Usage:\n' +
    '    paste [-H <height>]\n' +
    '    paste -h | --help\n\n' +
    'Options:\n' +
    '    -H <height>  Height of window in pixels [default: 400]\n' +
    '    -h --help    Show this message.\n';

Paste.prototype.do_output = check_live(function() {
    var self = this;

    if (!self._nextcb) {
        return;
    }
    var item = self.obuffer.shift();
    if (item === undefined) {
        return;
    }
    if (item === null) {
        self.div.remove();
        return self.exit();
    }
    return self.output(item);
});

Paste.prototype.next = check_next(do_docopt(function() {
    var self = this;

    if (self.inited) {
        return self.do_output();
    }

    self.inited = true;

    var height = isNaN(+self.docopts['-H']) ? 400 : +self.docopts['-H'],
        term = self.pterm(),
        tdiv = term.div;

    self.div = $('<div class="pterm-cli pt2"/>');
    tdiv.prepend(self.div);
    var navbar = '<div class="pterm-editor-navbar" style="border-top: 1px solid #ccc; border-right: 1px solid #ccc; border-left: 1px solid #ccc;">' +
        '<button class="pe-button pe-save">Emit</button>' +
        '<button class="pe-button pe-quit">Quit</button>' +
        '<button class="pe-button pe-savequit">Emit & Quit</button>' +
        '</div>';

    self.div.append(navbar);
    
    var pastediv = $('<div class="pterm-paste" contenteditable="true" style="border: 1px dashed #ccc; overflow: auto;"/>');
    pastediv.height(height);
    self.div.append(pastediv);
    self.div.find('.pe-save').on('click', function() {
        self.obuffer.push(pastediv.html());
        return self.do_output();
    });
    self.div.find('.pe-quit').on('click', function() {
        self.obuffer.push(null);
        return self.do_output();
    });
    self.div.find('.pe-savequit').on('click', function() {
        self.obuffer.push(pastediv.html());
        self.obuffer.push(null);
        return self.do_output();
    });
}));

Command.register("paste", Paste);

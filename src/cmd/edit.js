/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Edit(opts) {
    var self = this;

    Edit.base.call(self, opts);
}

inherit(Edit, Command);

Edit.prototype.usage = 'edit         -- edit file\n\n' +
    'Usage:\n' +
    '    edit [-o <opts>] <file>\n' +
    '    edit -h | --help\n\n' +
    'Options:\n' +
    '    -o <opts>    Options to pass to lower layers\n' +
    '    -h --help    Show this message.\n';

Edit.prototype.next = check_next(do_docopt(function(opts, cb) {
    var self = this;

    if (!isatty(opts.term)) {
        return self.exit("edit needs a terminal at stdout");
    }
    var cliopts = optstr_parse(self.docopts['-o']);
    fread.call(self, self.docopts['<file>'], function(err, res) {
        if (err) {
            if (err.code !== 'ENOENT') {
                return self.exit(err);
            }
            res = '';
        }
        to('text', res, {}, function(err, str) {
            if (err) {
                return self.exit(err);
            }
            return setup(str);
        });
    });

    function setup(res) {
        var term = opts.term,
            tdiv = term.div;

        self.div = $('<div class="pterm-cli pterm-editor pt2"/>').appendTo(tdiv);
        var navbar = '<div class="pterm-editor-navbar">' +
            '<button class="pe-button pe-save">Save</button>' +
            '<button class="pe-button pe-quit">Quit</button>' +
            '<div class="pe-status"></div>' +
            '</div>';
        self.div.append(navbar);
        var cmdiv = $('<div/>').appendTo(self.div),
            cmopts = $.extend({
                value: res,
                lineNumbers: true,
                lineWrapping: true,
                cursorBlinkRate: 630
            }, cliopts.CodeMirror);
        self.cm = CodeMirror(cmdiv[0], cmopts);
        self.div.data('codemirror', self.cm);
        self.cm.onSave = function() {
            var contents = self.cm.getValue();
            fwrite.call(self, self.docopts['<file>'], [contents],
                function(err, res) {
                if (err) {
                    flash('Error saving file');
                } else {
                    flash('Saved');
                }
            });
        };
        self.cm.onClose = function() {
            return cleanup();
        };

        self.div.find('.pe-save').on('click', self.cm.onSave);
        self.div.find('.pe-quit').on('click', self.cm.onClose);
        self.cm.setSize(null, 400);
        self.div.find('.CodeMirror-gutter').css({'background-color': '#f7f7f7',
            'border-right': '1px solid #eee'});
        self.div.find('.CodeMirror-gutter-text').css({'text-align': 'right'});
        self.div.find('.CodeMirror-scroll').css({'overflow': 'auto'});
        self.cm.refresh();
        self.cm.focus();
    }

    function cleanup(err) {
        self.cm = undefined;
        self.div.remove();
        return self.exit(err);
    }

    function flash(msg) {
        var p = self.div.find('.pe-status');
        p.stop(true);
        p.fadeOut(0);
        p.text(msg);
        p.fadeIn('fast').delay(500).fadeOut('slow');
    }
}));

Command.register("edit", Edit);

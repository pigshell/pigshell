/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var PtermBase = function(opts, pdir, div) {
    var self = this,
        move = opts ? opts.move : true;
    PtermBase.base.call(self, {});

    self.mime = 'directory';
    self.fs = pdir.fs;
    self.name = self.fs.newtid().toString();
    self.ident = pathjoin(pdir.ident, self.name);
    self.html = '<div class="pfolder">' + self.name + '</div>';

    var dataf = {name: 'data', ident: pathjoin(self.ident, 'data'), 
        readable: true, writable: true, removable: false, fs: self.fs,
        mime: 'text/plain', size: 0};
    dataf.html = '<div class="pfile">' + dataf.name + '</div>';
    self.data = new File(dataf);
    self.div = div;
    self.files = {'data': self.data};
    pdir.addfile(self, move);
    self.updatesize();
};

inherit(PtermBase, File);

PtermBase.prototype.readdir = function(opts, cb) {
    var self = this;
    return cb(null, self.files);
};

PtermBase.prototype.putdir = function(name, dlist, opts, cb) {
    var self = this,
        data;

    if (dlist.length === 0) {
        return cb(null, null);
    }
    if (name !== 'data') {
        return cb(E('EINVAL'), null);
    }
    self.clear();
    if (isstring(dlist[0])) {
        data = dlist.join('');
    } else {
        data = dlist[0];
    }
    self.append(data, opts, cb);
};

PtermBase.prototype.clear = function() {
    var self = this;

    for (var f in self.files) {
        if (f !== 'data') {
            self.files[f].remove();
            delete self.files[f];
       }
    }
    self.div.html('');
    self.mtime = Date.now();
};

PtermBase.prototype.remove = function() {
    var self = this;
    self.clear();
    self.div.remove();
    delete self.files['data'];
};

PtermBase.prototype.addfile = function(pterm, move) {
    var self = this;
    
    self.files[pterm.name] = pterm;
    self.updatesize();
    if (move !== false) {
        self.div.append(pterm.div);
    }
    self.mtime = Date.now();
};

PtermBase.prototype.rm = function(name, opts, cb) {
    var self = this;
    var rmf = self.files[name];

    if (rmf === undefined) {
        return cb(E('ENOENT'), null);
    }
    if (rmf.removable === false) {
        return cb(E('EACCES'), null);
    }

    if (rmf.mime === 'directory' && rmf.files.length > 1) {
        return cb(E('ENOTEMPTY'), null);
    }

    rmf.remove();
    delete self.files[name];
    self.updatesize();
    return cb(null, null);
};

PtermBase.prototype.read = function(opts, cb) {
    var self = this;

    return cb(null, self.div.clone(true, true)[0]);
};

PtermBase.prototype.append = function(item, opts, cb) {
    var self = this;

    function process(item) {
        if (item === null || item === undefined) {
            /* do nothing */
        } else if (item.constructor && item.constructor === HTMLCanvasElement) {
            var maxwidth = self.div.width();
            if (item.width > maxwidth) {
                item = cloneCanvas(item, maxwidth);
            }
            self.hecho(item);
        } else if (item instanceof HTMLDivElement) {
            self.hecho(item);
        } else if (item.html) {
            self.hecho(item.html);
            if (typeof item.callback === 'function') {
                item.callback();
            }
        } else if (item.div) { 
            self.hecho('<div/>').append(item.div);
        } else if (item instanceof HTMLIFrameElement) {
            var maxwidth = self.div.width(),
                height = $(window).height(),
                div = self.hecho('<div/>');
            item.setAttribute('style', sprintf("width:%dpx; height:%dpx", maxwidth, height));
            div[0].appendChild(item);
            rescroll(self.div);
        } else {
            self.echo(item.toString());
        }
        self.mtime = Date.now();
        if (cb !== undefined) {
            return cb(null, null);
        }
    }

    function blobdisplay(blob, type) {
        var dh = VFS.lookup_media_ui(type) || VFS.lookup_media_ui('application/octet-stream');
        if (dh && dh.handler.display) {
            dh.handler.display(item, self, function(err, res) {
                if (!err) {
                    return process(res);
                }
                return process(item);
            });
        } else {
            return process(item);
        }
    }

    if (item instanceof Blob) {
        var itype = item.type || 'application/octet-stream';

        if (itype === 'application/octet-stream') {
            Magic.probe(item, function(err, mime, desc) {
                var t = mime || itype;
                blobdisplay(item, t);
            });
        } else {
            blobdisplay(item, itype);
        }
    } else {
        return process(item);
    }
};

PtermBase.prototype.echo = function(str) {
    var self = this,
        lines,
        output = '';

    if (str === null || str === undefined) {
        console.log('Pterm.echo got null/undefined');
        return;
    }
    lines = str.toString();
    if (!isstring(lines)) {
        console.log('Pterm.echo got a non-string');
        return;
    }
    self.div.append('<span class="ptextwrap pt2">' + tohtml(lines) + '</span>');
    rescroll(self.div);
    return self.div;
};

PtermBase.prototype.hecho = function(str) {
    var self = this,
        div = $(str);

    self.div.append(div);
    rescroll(self.div);
    return div;
};

/*
 * Not sure this is the best way - may be too expensive to do this at every
 * output
 */

pigshell._rescroll_enabled = true;

function rescroll(div) {
    if (!pigshell._rescroll_enabled) {
        return;
    }
    var main = div.closest('div.pterm-root'),
        cli = main.find('div.pterm-cli').last();

    if (cli.length) {
        var offset = cli.offset(),
            ctop = offset.top,
            cheight = cli.height(),
            w = $(window),
            wtop = w.scrollTop(),
            height = w.height();
        if (ctop < wtop || ctop + cheight > wtop + height) {
            w.scrollTop(ctop + cheight - height + 16);
        }
    }
}

var PtermFS = function(opts) {
    PtermFS.base.call(this);
    this.opts = $.extend({'cache': true}, opts);
    this.tid = 1;
    var rootfile = {
        name: '/',
        ident: 'pterm://root',
        readable: true,
        writable: true,
        fs: this,
        mime: 'directory',
        htmlClass: 'pfolder',
        files: {},
        populated: true
    };
    this.root = new File(rootfile);
    this.root.addfile = PtermBase.prototype.addfile;
    this.root.rm = PtermBase.prototype.rm;
    this.root.putdir = File.prototype.enosys;
};

inherit(PtermFS, Filesystem);

PtermFS.hname = 'PtermFS';

PtermFS.prototype.newtid = function() {
    return this.tid++;
};

function Pterm(opts, pdir, div) {
    var self = this;

    Pterm.base.call(self, opts, pdir, div);
    self.options = opts;
    self.div.addClass('pterm-output');

    self.data.read = self.read.bind(self);
    self.data.append = self.append.bind(self);
}

inherit(Pterm, PtermBase);


function Readline(opts, div) {
    var self = this;

    self.options = opts;

    self.active = true;
    self.div = div;
    self._line = '';
    self._position = 0;
    self.div.addClass('pterm-cli pt2');
    self.cm = CodeMirror(self.div[0], {
        value: '',
        lineNumbers: false,
        lineWrapping: true,
        cursorBlinkRate: 630,
        onKeyEvent: self.cm_keydown.bind(self),
        extraKeys: { "Ctrl-W": "delWordLeft",
            "Ctrl-U": function(cm) {
               var c = cm.getCursor();
               cm.replaceRange('', {line: c.line, ch: 0}, c);
             }
        }
    });
    self.div.data('codemirror', self.cm);
    if (self.options.prompt) {
        self.cm.setOption('gutter', true);
        self.cm.setMarker(0, self.options.prompt, 'prompt');
    }
    if (pigshell._rescroll_enabled) {
        self.cm.focus();
    }
    self.cm_mode = 'line';
}

/*
 * Used by someone (like popular scripts link) wanting to put words in our
 * mouth.
 */

Readline.prototype.cli_input = function(str) {
    var self = this;

    self.line(str);

    var line = self.cm.getLine(0);
    self.cm.setOption('readOnly', true);
    self.options.input(line);
};

Readline.prototype.cm_keydown = function(cm, e) {
    var self = this;

    //console.log('type: ' + e.type + ' which: ' + e.which);
    if (!self.active) {
        return false;
    }
    if (e.type === 'keyup') {
        return false;
    }
    if (self.options.keydown && self.options.keydown(e) === false) {
        e.stop();
        return true;
    }

    if (self.cm_mode === 'line') {
        if (e.which === 13) { /* enter */
            if (e.type === 'keydown') {
                pigshell._rescroll_enabled = true;
                /* firefox gives both keydown and keypress events for enter */
                var line = cm.getLine(0);
                cm.setOption('readOnly', true);
                self.options.input(line);
            }
            e.stop();
            return true;
        } else if (e.ctrlKey && e.which === 83) { /* ctrl-s */
            self.cm_mode = 'multi';
            if (self.options.prompt) {
                cm.setMarker(0, 'multi>', 'prompt');
            } else {
                cm.setOption('lineNumbers', true);
            }
        }
    } else if (e.ctrlKey && e.which === 81) { /* ctrl-q */
        cm.setOption('readOnly', true);
        var str = cm.getValue();
        self.options.input(str);
        e.stop();
        return true;
    }
    return false;
};

Readline.prototype.position = function(arg) {
    var self = this,
        cm = self.cm,
        line, cursor;

    if (self.cm_mode !== 'line') {
        return undefined;
    }
    line = cm.getLine(0);
    cursor = cm.getCursor();
    if (isnumber(arg)) {
        var pos = arg < 0 ? 0 : (arg > line.length ? line.length : arg);
        cm.setCursor(cursor.line, pos);
    }
    cursor = cm.getCursor();
    return cursor.ch;
};

Readline.prototype.line = function(arg) {
    var self = this,
        cm = self.cm;

    if (self.cm_mode !== 'line') {
        return undefined;
    }
    if (isstring(arg)) {
        cm.setLine(0, arg);
        self.position(arg.length);
    }
    return cm.getLine(0);
};

Readline.prototype.insert = function(str) {
    var self = this,
        cm = self.cm;
    
    cm.replaceRange(str, cm.getCursor());
};

Readline.prototype.deactivate = function() {
    var self = this,
        cm = self.cm;
    cm.setOption('readOnly', true);
    self.div.data('codemirror', undefined);
    self.div.find('.CodeMirror-cursor').remove();
    self.active = false;
};

Readline.prototype.remove = function() {
    var self = this,
        div = self.div;

    self.deactivate();
    div.remove();
};

Readline.prototype.prompt = function(prstr, prclass) {
    var self = this,
        pr = prstr || self.options.prompt,
        prc = prclass || 'prompt';

    self.options.prompt = pr;
    self.cm.setMarker(0, pr, prc);
};

/* Monkey-patch CM to send us a save callback */
CodeMirror.commands.save = function(cm) {
    if (typeof cm.onSave === 'function') {
        cm.onSave();
    }
};
CodeMirror.commands.close = function(cm) {
    if (typeof cm.onClose === 'function') {
        cm.onClose();
    }
};

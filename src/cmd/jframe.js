/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Jframe(opts) {
    var self = this;

    Jframe.base.call(self, opts);
    self.olist = [];
    self.context = {};
    self.ediv = null;
}

inherit(Jframe, Command);

Jframe.prototype.usage = 'jframe       -- display content in iframe\n\n' +
    'Usage:\n' +
    '    jframe -h | --help\n' +
    '    jframe [-o <opts>] [-c <css>] [-a <sopts>] [-O] <template> [<obj>...]\n' +
    '    jframe [-o <opts>] [-c <css>] [-a <sopts>] [-O] -s <tstr> [<obj>...]\n\n' +
    'Options:\n' +
    '    <template>   IFrame file path\n' +
    '    <obj>        Object to display through iframe template\n' +
    '    -c <css>     JSON string of CSS settings to be applied to iframe\n' +
    '    -s <tstr>    IFrame template string\n' +
    '    -o <opts>    Options to be passed to iframe template\n' +
    '    -a <sopts>   Comma separated list of sandbox options to enabled\n' +
    '    -O           IFrame goes to standard output; ediv is not used\n' +
    '    -h --help    Show this message.\n';

Jframe.prototype.next = check_next(do_docopt(objargs(function(opts, cb) {
    var self = this;

    if (self.inited === undefined) {
        return init();
    } else {
        return next();
    }

    function init() {
        var cvars,
            cliopts = optstr_parse(self.docopts['-o'], true),
            sopts = ['forms', 'popups', 'pointer-lock', 'same-origin',
                'scripts', 'top-navigation'];

        self.inited = true;
        self.cliopts = cliopts;

        if (self.docopts['-O'] && !isatty(opts.term)) {
            return self.exit('stdout not a term');
        }
        if (!self.docopts['-O'] && !self.ediv) {
            return self.exit('ediv not available');
        }

        if (self.docopts['-a']) {
            var sboxopts = self.docopts['-a'].split(',');
            sboxopts = sboxopts.filter(function(s) { return sopts.indexOf(s) !== -1; });
            sboxopts = sboxopts.map(function(s) { return 'allow-' + s; });
            self.sboxopts = sboxopts.join(' ');
        } else {
            self.sboxopts = 'allow-scripts';
        }
            
        if (self.docopts['-s']) {
            self.template = self.docopts['-s'];
            self.mode = 'srcdoc';
            return make_iframe();
        }
        var u = URI.parse(self.docopts['<template>']);
        if (u.isAbsolute()) {
            self.mode = 'url';
            self.template = self.docopts['<template>'];
            return make_iframe();
        }
        fread.call(self, self.docopts['<template>'], function(err, res) {
            if (err) {
                return self.exit(err);
            }
            to('text', res, {}, function(err, res) {
                if (err) {
                    return self.exit(err);
                }
                self.template = res;
                self.mode = 'srcdoc';
                return make_iframe();
            });
        });
    }

    function make_iframe() {
        var iframe = document.createElement('iframe'),
            dwidth = self.pterm().div.width(),
            dheight = $(window).height(),
            css = parse_json(self.docopts['-c']) || {},
            width = dwidth,
            height = Math.ceil(dheight * 2 / 3);

        var cssdef = {
            'width': width.toString() + 'px',
            'height': height.toString() + 'px',
            'border': 'none'
        };

        css = $.extend({}, cssdef, css);
        var css_str = Object.keys(css).map(function(c) { return c + ':' + css[c]; }).join('; ');

        iframe.setAttribute('style', css_str);
        iframe.setAttribute('name', 'pigshell_frame:{"ver": "1.0", "msg": "postMessage"}');
        iframe.setAttribute("sandbox", self.sboxopts);
        iframe.onload = function() {
            proc.current(self);
            sendmsg('config', {opts: self.cliopts, css: css});
            self.loaded = true;
            if (self.next_pending) {
                self.next_pending = false;
                return next();
            }
        };
        iframe.onerror = function() {
            proc.current(self);
            return self.exit("IFrame load error");
        };
        self.iframe = iframe;
        window.addEventListener('message', recvmsg);

        if (self.mode === 'srcdoc') {
            iframe.setAttribute("srcdoc", self.template);
        } else {
            iframe.setAttribute("src", self.template);
        }
        if (self.docopts['-O']) {
            return self.output({html: iframe});
        } else {
            self.next_pending = true;
            self.ediv.append(iframe);
        }
    }

    function recv_config(data) {
        //console.log("CONFIG", data);
        if (data && data.height !== undefined && !self.docopts['-H']) {
            $(self.iframe).height(data.height + 10);
        }
    }

    function sendmsg(op, data) {
        self.iframe.contentWindow.postMessage({op: op, data: data}, '*');
    }

    function recvmsg(e) {
        if (e.source !== self.iframe.contentWindow) {
            return;
        }
        var msg = e.data,
            op = msg.op,
            data = msg.data;

        //console.log("JFRAME RECV", op, data);
        if (op === 'next') {
            self.unext({}, cef(self, function(obj) {
                /*
                 * XXX Files are the most common objects which can't pass
                 * the structured-clone barrier due to presence of methods.
                 * What's the best way to deal with them?
                 */
                if (obj instanceof File || (obj && obj._path && obj.fs)) {
                    obj = clean_file(obj);
                }
                return sendmsg('data', obj);
            }));
        } else if (op === 'config') {
            return recv_config(data);
        } else if (op === 'data') {
            return self.output(data);
        } else if (op === 'errmsg') {
            return self.errmsg(data);
        } else if (op === 'exit') {
            return self.exit(data);
        } else {
            console.log("Unknown message from iframe", op);
            return;
        }
    }

    function next() {
        if (!self.loaded) {
            self.next_pending = true;
            return;
        }
        return sendmsg('next');
    }

    function clean_file(file) {
        var avoid = ["_lfile", "_ufile", "files", "data", "fs"],
            cf = {};

        if (file === undefined) {
            return undefined;
        }
        for (var k in file) {
            if (avoid.indexOf(k) === -1 && typeof file[k] !== 'function') {
                cf[k] = file[k];
            }
        }
        if (file.files) {
            cf.files = Object.keys(file.files);
        }
        cf._lfile = clean_file(file._lfile);
        return cf;
    }
})));

Command.register("jframe", Jframe);

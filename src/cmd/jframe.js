/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Jframe(opts) {
    var self = this;

    Jframe.base.call(self, opts);
    self.olist = [];
    self.context = {};
}

inherit(Jframe, Command);

Jframe.prototype.usage = 'jframe       -- display content in iframe\n\n' +
    'Usage:\n' +
    '    jframe -h | --help\n' +
    '    jframe [-o <opts>] [-W <width>] [-H <height>] [-a <sopts>] [-g] <template> [<obj>...]\n' +
    '    jframe [-o <opts>] [-W <width>] [-H <height>] [-a <sopts>] [-g] -s <tstr> [<obj>...]\n\n' +
    'Options:\n' +
    '    <template>   IFrame file path\n' +
    '    <obj>        Object to display through iframe template\n' +
    '    -W <width>   Width of iframe in pixels or percentage\n' + 
    '    -H <height>  Height of iframe in pixels or percentage\n' + 
    '    -s <tstr>    IFrame template string\n' +
    '    -o <opts>    Options to be passed to iframe template\n' +
    '    -a <sopts>   Comma separated list of sandbox options to enabled\n' +
    '    -g           Gather all objects and deliver to iframe as a list\n' +
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
            uwidth = self.docopts['-W'],
            uheight = self.docopts['-H'],
            width = dwidth,
            height = dheight * 2 / 3,
            term = self.pterm(),
            tdiv = term.div;

        if (uwidth) {
            width = (uwidth[uwidth.length - 1] === '%') ? +uwidth.slice(0, -1) / 100 * dwidth : +uwidth;
        }
        if (uheight) {
            height = (uheight[uheight.length - 1] === '%') ? +uheight.slice(0, -1) / 100 * dheight : +uheight;
        }

        iframe.setAttribute('style', sprintf("width:%dpx; height:%dpx; border:none;", width, height));
        iframe.setAttribute('name', 'pigshell_frame:{"ver": "1.0", "msg": "postMessage"}');
        iframe.setAttribute("sandbox", self.sboxopts);
        iframe.onload = function() {
            proc.current(self);
            return next();
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
        tdiv.append($(iframe));
    }

    function config(data) {
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
            return config(data);
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

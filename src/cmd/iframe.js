/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Iframe(opts) {
    var self = this;

    Iframe.base.call(self, opts);
    self.olist = [];
    self.context = {};
    self._event_handler = null;
}

inherit(Iframe, Command);

Iframe.prototype.usage = 'iframe       -- display content in iframe\n\n' +
    'Usage:\n' +
    '    iframe -h | --help\n' +
    '    iframe [-o <opts>] [-a <sopts>] [-g] <template> [<obj>...]\n' +
    '    iframe [-o <opts>] [-a <sopts>] [-g] -s <tstr> [<obj>...]\n\n' +
    'Options:\n' +
    '    <template>   IFrame file path\n' +
    '    <obj>        Object to display through iframe template\n' +
    '    -s <tstr>    IFrame template string\n' +
    '    -o <opts>    Options to be passed to iframe template\n' +
    '    -a <sopts>   Comma separated list of sandbox options to enabled\n' +
    '    -g           Gather all objects and deliver to iframe as a list\n' +
    '    -h --help    Show this message.\n';

Iframe.prototype.next = check_next(do_docopt(objargs(function(opts, cb) {
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

        if (!isatty(opts.term)) {
            return self.exit("iframe needs a terminal at stdout");
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
            maxwidth = self.pterm().div.width(),
            height = $(window).height() * 2/3,
            term = opts.term,
            tdiv = term.div;

        iframe.setAttribute('style', sprintf("width:%dpx; height:%dpx; border:none;", maxwidth, height));
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
        self._event_handler = set_height;
        window.addEventListener('message', self._event_handler);

        if (self.mode === 'srcdoc') {
            iframe.setAttribute("srcdoc", self.template);
        } else {
            iframe.setAttribute("src", self.template);
        }
        tdiv.append($(iframe));
    }

    function set_height(e) {
        if (e.source === self.iframe.contentWindow) {
            var h = e.data;
            if (h && h.height !== undefined) {
                $(self.iframe).height(h.height + 10);
            }
            if (self._event_handler) {
                window.removeEventListener('message', self._event_handler);
            }
        }
    }

    function next() {
        self.unext({}, cef(self, function(obj) {
            if (obj === null) {
                if (self.docopts['-g']) {
                    self.iframe.contentWindow.postMessage({opts: self.cliopts, data: self.olist}, '*');
                }
                return self.exit();
            }
            if (self.docopts['-g']) {
                self.olist.push(obj);
            } else {
                self.iframe.contentWindow.postMessage({opts: self.cliopts, data: obj}, '*');
            }
            return next();
        }));
    }

})));

Command.register("iframe", Iframe);

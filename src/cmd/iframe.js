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
    '    iframe [-o <opts>] [-g] <template> [<obj>...]\n' +
    '    iframe [-o <opts>] [-g] -s <tstr> [<obj>...]\n\n' +
    'Options:\n' +
    '    <template>   IFrame file path\n' +
    '    <obj>        Object to display through iframe template\n' +
    '    -s <tstr>    IFrame template string\n' +
    '    -o <opts>    Options to be passed to iframe template\n' +
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
            cliopts = optstr_parse(self.docopts['-o'], true);

        self.inited = true;
        self.cliopts = cliopts;

        if (!isatty(opts.term)) {
            return self.exit("edit needs a terminal at stdout");
        }
        if (self.docopts['-s']) {
            self.template = self.docopts['-s'];
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
        iframe.setAttribute("sandbox", "allow-scripts");
        iframe.onload = function() {
            proc.current(self);
            self.iframe = iframe;
            return next();
        };
        iframe.onerror = function() {
            proc.current(self);
            return self.exit("IFrame load error");
        };
        window.addEventListener('message', set_height);
        self._event_handler = set_height;

        iframe.setAttribute("srcdoc", self.template);
        tdiv.append($(iframe));

    }

    function set_height(e) {
        console.log("GOT EVENT");
        if (e.origin === "null" && e.source === self.iframe.contentWindow) {
            var h = e.data;
            if (h && h.height !== undefined) {
                $(self.iframe).height(h.height + 10);
            }
        }
    }
    function next() {
        self.unext({}, cef(self, function(obj) {
            if (obj === null) {
                if (self.docopts['-g']) {
                    self.iframe.contentWindow.postMessage([self.cliopts, self.olist], '*');
                }
                return self.exit();
            }
            if (self.docopts['-g']) {
                self.olist.push(obj);
            } else {
                self.iframe.contentWindow.postMessage([self.cliopts, obj], '*');
            }
            return next();
        }));
    }

})));


Iframe.prototype.exit = function() {
    var self = this;

    if (self._event_handler) {
        window.removeEventListener('message', self._event_handler);
    }
    return Iframe.base.prototype.exit.apply(this, arguments);
};

Command.register("iframe", Iframe);

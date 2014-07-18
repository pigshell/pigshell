/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Template(opts) {
    var self = this;

    Template.base.call(self, opts);
    self.flist = [];
    self.context = {};
    self._event_handler = null;
}

inherit(Template, Command);

Template.scripts = ["extra/handlebars-1.0.0.beta.6.js"];

Template.prototype.usage = 'template     -- pretty print files using template\n\n' +
    'Usage:\n' +
    '    template -h | --help\n' +
    '    template [-o <opts>] [-c <cvar>] [-ig] <template> [<file>...]\n' +
    '    template [-o <opts>] [-c <cvar>] [-ig] -s <tstr> [<file>...]\n\n' +
    'Options:\n' +
    '    <template>   Template file path\n' +
    '    <file>       File to display through template\n' +
    '    -s <tstr>    Template string\n' +
    '    -c <cvar>    Comma separated list of shell variables to use as template context\n' +
    '    -o <opts>    Options to be passed to iframe template\n' +
    '    -g           Gather all files and deliver to template as a list\n' +
    '    -i           Render in iframe (implies -g)\n' +
    '    -h --help    Show this message.\n';

Template.prototype.next = check_next(loadscripts(do_docopt(fileargs(function() {
    var self = this;

    if (self.inited === undefined) {
        var cvars,
            cliopts = optstr_parse(self.docopts['-o'], true);

        self.inited = true;
        self.use_iframe = self.docopts['-i'];
        self.cliopts = cliopts;

        if (self.use_iframe) {
            self.docopts['-g'] = true;
        }

        self.context['pid'] = self.shell.pid;
        if (self.docopts['-c']) {
            cvars = self.docopts['-c'].split(',');
            for (var i = 0; i < cvars.length; i++) {
                var cval = sys.getenv(self, cvars[i]);
                if (cval === undefined) {
                    return self.exit("Context variable " + cvars[i] + " undefined");
                }
                self.context[cvars[i]] = (cval.length === 1) ? cval[0] : cval;
            }
        }
        Handlebars.registerHelper('canvas', function(item) {
            return item.toDataURL();
        });
        if (self.docopts['-s']) {
            self.template = Handlebars.compile(self.docopts['-s']);
            return next();
        }
        fread.call(self, self.docopts['<template>'], function(err, res) {
            if (err) {
                return self.exit(err);
            }
            to('text', res, {}, function(err, res) {
                if (err) {
                    return self.exit(err);
                }
                self.template = Handlebars.compile(res);
                return next();
            });
        });
    } else {
        return next();
    }

    function next() {
        self.unext({}, cef(self, function(file) {
            if (file === null) {
                if (self.docopts['-g']) {
                    self.done = true;
                    self.context['files'] = self.flist;
                    return output();
                }
                return self.exit();
            }
            if (self.docopts['-g']) {
                self.flist.push(file);
                return next();
            }
            self.context['file'] = file;
            return output(file);
        }));
    }

    function output(file) {
        if (!self.use_iframe) {
            return self.output({html: self.template(self.context)});
        } else {
            var iframe = document.createElement('iframe'),
                maxwidth = self.pterm().div.width(),
                height = $(window).height() * 2/3,
                div = $('<div/>');

            self.context['width'] = maxwidth;
            self.context['height'] = height;
            var res = self.template(self.context);
            iframe.setAttribute('style', sprintf("width:%dpx; height:%dpx; border:none;", maxwidth, height));
            iframe.setAttribute("sandbox", "allow-scripts");
            iframe.onload = function() {
                proc.current(self);
                var data = self.docopts['-g'] ? self.flist : file;
                iframe.contentWindow.postMessage([self.cliopts, data], '*');
            };
            self._event_handler = set_height;
            window.addEventListener('message', self._event_handler);

            iframe.setAttribute("srcdoc", res);
            div.append($(iframe));
            self.output(div[0]);
        }
        function set_height(e) {
            if (e.origin === "null" && e.source === iframe.contentWindow) {
                var h = e.data;
                $(iframe).height(h + 10);
                window.removeEventListener('message', self._event_handler);
            }
        }
    }
}))));


Template.prototype.exit = function() {
    
    if (self._event_handler) {
        window.removeEventListener('message', self._event_handler);
    }
    return Template.base.prototype.exit.apply(this, arguments);
}

Command.register("template", Template);

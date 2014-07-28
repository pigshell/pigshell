/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Template(opts) {
    var self = this;

    Template.base.call(self, opts);
    self.flist = [];
    self.context = {};
}

inherit(Template, Command);

Template.scripts = ["extra/handlebars-1.0.0.beta.6.js"];

Template.prototype.usage = 'template     -- pretty print files using template\n\n' +
    'Usage:\n' +
    '    template -h | --help\n' +
    '    template [-c <cvar>] [-g] <template> [<file>...]\n' +
    '    template [-c <cvar>] [-g] -s <tstr> [<file>...]\n\n' +
    'Options:\n' +
    '    <template>   Template file path\n' +
    '    <file>       File to display through template\n' +
    '    -s <tstr>    Template string\n' +
    '    -c <cvar>    Comma separated list of shell variables to use as template context\n' +
    '    -g           Gather all files and deliver to template as a list\n' +
    '    -h --help    Show this message.\n';

Template.prototype.next = check_next(loadscripts(do_docopt(fileargs(function() {
    var self = this;

    if (self.inited === undefined) {
        var cvars;

        self.inited = true;

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
            return output();
        }));
    }

    function output() {
        return self.output({html: self.template(self.context)});
    }
}))));

Command.register("template", Template);

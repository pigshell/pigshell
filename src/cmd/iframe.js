/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var _pframe_channel_id = 1;
window.pframe_mbox = {};

function Iframe(opts) {
    var self = this;

    Iframe.base.call(self, opts);
    self.olist = [];
    self.ediv = null;
    self.proto_supported = ['1.0'];
    self.msg_supported = ['postMessage', 'mbox'];
}

inherit(Iframe, Command);

Iframe.prototype.usage = 'iframe       -- display content in iframe\n\n' +
    'Usage:\n' +
    '    iframe -h | --help\n' +
    '    iframe [-o <opts>] [-c <css>] [-a <sopts>] [-zO] <template> [<obj>...]\n' +
    '    iframe [-o <opts>] [-c <css>] [-a <sopts>] [-zO] -s <tstr> [<obj>...]\n\n' +
    'Options:\n' +
    '    <template>   IFrame file path\n' +
    '    <obj>        Object to display through iframe template\n' +
    '    -c <css>     JSON string of CSS settings to be applied to iframe\n' +
    '    -s <tstr>    IFrame template string\n' +
    '    -o <opts>    Options to be passed to iframe template\n' +
    '    -a <sopts>   Comma separated list of sandbox options to enabled\n' +
    '    -O           IFrame goes to standard output; ediv is not used\n' +
    '    -z           "Dumb" mode. Post all objects in one message.\n' +
    '    -h --help    Show this message.\n';

Iframe.prototype.next = check_next(do_docopt(objargs(function(opts, cb) {
    var self = this;

    if (self.inited === undefined) {
        return init();
    } else {
        self.next_pending = true;
        return update();
    }

    function init() {
        var cvars,
            cliopts = optstr_parse(self.docopts['-o'], true),
            sopts = ['forms', 'popups', 'pointer-lock', 'same-origin',
                'scripts', 'top-navigation'];

        self.inited = true;
        self.cliopts = cliopts;

        self.docopts['-O'] = self.docopts['-O'] || self.docopts['-z'];
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
            width = dwidth,
            height = Math.ceil(dheight * 2 / 3);

        self.css_opt = parse_json(self.docopts['-c']) || {};

        var cssdef = {
            'width': width.toString() + 'px',
            'height': height.toString() + 'px',
            'border': 'none'
        };

        var css = $.extend({}, cssdef, self.css_opt),
            css_str = Object.keys(css).map(function(c) { return c + ':' + css[c]; }).join('; '),
            ver_str;

        if (self.docopts['-z']) {
            ver_str = 'pframe:' + JSON.stringify({
                ver: [0],
                msg: "postMessage"
            });
        } else {
            ++_pframe_channel_id;
            self.channel_id = 'pframe_' + _pframe_channel_id;
            self.mbox = {inbox: undefined, outbox: undefined};
            window.pframe_mbox[self.channel_id] = self.mbox;
            ver_str = 'pframe:' + JSON.stringify({
                ver: self.proto_supported,
                msg: self.msg_supported,
                cid: self.channel_id,
                origin: window.location.origin
            });
        }

        iframe.setAttribute('style', css_str);
        iframe.setAttribute('name', ver_str);
        iframe.setAttribute("sandbox", self.sboxopts);
        iframe.onload = function() {
            proc.current(self);
            self.loaded = true;
            update();
        };
        iframe.onerror = function() {
            proc.current(self);
            return self.exit("IFrame load error");
        };
        self.iframe = iframe;

        if (!self.docopts['-z']) {
            self.msg_listener = recvmsg;
            window.addEventListener('message', recvmsg);
        }

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

    function next_z() {
        self.unext({}, cef(self, function(obj) {
            if (obj === null) {
                self.iframe.contentWindow.postMessage({opts: self.cliopts, data: self.olist}, '*');
                return self.exit();
            }
            self.olist.push(obj);
            return next_z();
        }));
    }

    function update() {
        if (!self.loaded) {
            return;
        }
        if (self.docopts['-z']) {
            if (self.next_pending) {
                return next_z();
            }
            return;
        }
        if (self.proto && !self.config_sent) {
            self.config_sent = true;
            sendmsg('config', {opts: self.cliopts, pigshell_baseurl: pigshell_baseurl});
        }
        if (self.proto && self.next_pending) {
            self.next_pending = false;
            return next();
        }
    }

    function recv_config(data) {
        //console.log("CONFIG", data);
        if (!data) {
            return;
        }
        if (data.proto) {
            var proto = data.proto,
                ver = proto.ver.split('.'),
                msgproto = proto.msg;

            if (ver[0] !== '1' ||
                self.msg_supported.indexOf(msgproto) === -1) {
                return self.exit('Bad proto from iframe');
            }
            self.proto = {ver: ver, msg: msgproto};
            update();
        } else if (data.height !== undefined && !self.css_opt['height']) {
            $(self.iframe).height(data.height);
        }
    }

    function sendmsg(op, obj) {
        var msg = {};
        msg[self.channel_id] = {op: op, data: obj};
        self.iframe.contentWindow.postMessage(msg, '*');
    }

    function recvmsg(e) {
        var msg = e.data instanceof Object ? e.data[self.channel_id] : undefined;
        if (e.source !== self.iframe.contentWindow || msg === undefined) {
            return;
        }
        var op = msg.op,
            data = msg.data;

        //console.log("JFRAME RECV", op, data);
        if (op === 'next') {
            self.unext({}, cef(self, function(obj) {
                if (self.proto.msg === 'mbox') {
                    self.mbox.outbox = obj;
                    obj = undefined;
                } else if (obj instanceof File ||
                    (obj && obj._path && obj.fs)) {
                    /*
                     * XXX Files are the most common objects which can't pass
                     * the structured-clone barrier due to presence of methods.
                     * What's the best way to deal with them?
                     */
                    obj = clean_file(obj);
                }
                return sendmsg('data', obj);
            }));
        } else if (op === 'config') {
            return recv_config(data);
        } else if (op === 'data') {
            if (self.proto.msg === 'mbox') {
                if (self.mbox.inbox === undefined) {
                    return self.exit('IFrame broke mbox protocol');
                }
                return self.output(self.mbox.inbox);
            } else {
                return self.output(data);
            }
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

Iframe.prototype.cleanup = function() {
    var self = this;

    if (self.mbox_id) {
        delete window.pframe_mbox[self.mbox_id];
    }
    if (self.msg_listener) {
        window.removeEventListener('message', self.msg_listener);
    }
};

Iframe.prototype.kill = function(reason) {
    var self = this;

    self.cleanup();
    Iframe.base.prototype.kill.call(self, reason);
};

Iframe.prototype.exit = function(val) {
    var self = this;

    self.cleanup();
    Iframe.base.prototype.exit.call(self, val);
};

Command.register("iframe", Iframe);

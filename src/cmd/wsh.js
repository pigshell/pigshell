/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Wsh(opts) {
    var self = this;

    Wsh.base.call(self, opts);
    self.obuffer = [];
    self.retcode = false;
}

inherit(Wsh, Command);

Wsh.PREFIX_VERSION = "1.0";
Wsh.PREFIX_LENGTH = 128;

Wsh.prototype.usage = 'wsh          -- websocket shell\n\n' +
    'Usage:\n' +
    '    wsh [-i] <cmd> [<arg>...]\n' +
    '    wsh -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -i           Take input from terminal\n' +
    '    <cmd>        Remote command\n' +
    '    <arg>        Argument to remote command\n';

Wsh.prototype.do_output = check_live(function() {
    var self = this;

    if (!self._nextcb) {
        return;
    }
    var item = self.obuffer.shift();
    if (item === undefined) {
        return;
    }
    if (item === null) {
        self.done = self.retcode;
        return self.eof();
    }
    return self.output(item);
});

Wsh.prototype.next = check_next(do_docopt(function() {
    var self = this;

    if (self.inited) {
        return self.do_output();
    }

    self.inited = true;
    var wsuri = URI.parse(VFS.lookup_tx("proxy").uri);
    wsuri.scheme(wsuri.scheme() === "http" ? "ws" : "wss");
    var server = wsuri.toString();

    var cmdstr = $.param({cmd: [self.docopts['<cmd>']].concat(self.docopts['<arg>'])}),
        pwd = self.pwd(),
        pwdcomps = pwd.split('/'),
        dir = '';

    if (pwdcomps[1] === 'home') {
        dir = pwdcomps.slice(2).join('/');
    }
    try {
        self.ws = new WebSocket(server + dir + '?' + cmdstr);
    } catch (e) {
        console.log("Socket exception:" + e);
        return self.exit(e);
    }

    self.ws.onopen = function(e) {
        proc.current(self);
        if (self.fds.stdin instanceof Stdin && !self.docopts['-i']) {
            return;
        }
        return next();
    };
    self.ws.onclose = function(e) {
        proc.current(self);
        if (self.done === undefined) {
            if (self.retcode === undefined) {
                self.retcode = false;
            }
            self.obuffer.push(null);
            return self.do_output();
        }
    };
    self.ws.onmessage = function(e) {
        proc.current(self);
        self.wrecv(e.data);
    };
    self.ws.onerror = function(e) {
        proc.current(self);
        console.log(e);
        if (self.done === undefined) {
            return self.exit("websocket error");
        }
    };

    function next() {
        self.unext({}, cef(self, function(item) {
            if (item === null) {
                self.wsend(null);
                return;
            }
            to('base64', item, {}, function(err, res) {
                if (err) {
                    return self.wclose();
                }
                self.wsend(res);
                return next();
            });
        }));
    }
}));

Wsh.prototype.wclose = function(c, r) {
    var self = this,
        code = (code !== undefined) ? code : 1000,
        reason = (r !== undefined) ? r : "Normal";
    self.ws.close(code, reason);
};

Wsh.prototype.wsend = function(data) {
    /*
     * Payload: Fixed length 128-bytes of space-padded JSON string
     * followed by base64 encoded data
     */
    var self = this,
        prefix = '{"pwsver":"' + Wsh.PREFIX_VERSION + '","fd":0,"enc":"base64"';
    prefix += (data === null) ? ',"eof":true}' : '}';
    var suffix = new Array(Wsh.PREFIX_LENGTH - prefix.length + 1).join(' '),
        header = prefix + suffix,
        msg = (data === null) ? header : header + data;

    self.wmsgsend(msg);
};

Wsh.prototype.wmsgsend = function(msg) {
    var self = this;
    try {
        self.ws.send(msg);
    } catch (e) {
        console.log("Socket exception:" + e);
        return self.wclose(1011, "My message is too long");
    }
};

Wsh.prototype.wrecv = function(data) {
    var self = this;

    if (data.length < Wsh.PREFIX_LENGTH) {
        return self.wclose(1002, "Message too short");
    }
    var header = data.slice(0, Wsh.PREFIX_LENGTH),
        prefix = $.parseJSON(header);

    if (!prefix) {
        return self.wclose(1002, "Bad prefix");
    }
    if (prefix.fd === 2) {
        self.fds.stderr.append(atob(data.slice(Wsh.PREFIX_LENGTH)),
            {context: this}, function(){});
    } else {
        var data = data.slice(Wsh.PREFIX_LENGTH),
            blob = data.length ? base642blob(data) : null;
        self.obuffer.push(blob);
        if (prefix.eof) {
            self.retcode = (prefix.retcode === undefined ||
                prefix.retcode === 0) ? true : prefix.retcode;
            if (blob) {
                self.obuffer.push(null);
            }
        }
        return self.do_output();
    }
};

Wsh.prototype.kill = function(reason) {
    var self = this;

    if (self.ws) {
        self.wclose(1000, "wsh killed");
    }
    Wsh.base.prototype.kill.call(self, reason);
};

Command.register("wsh", Wsh);

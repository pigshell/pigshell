/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Proc() {
    this.proc = {};
    this._lastpid = 1;
    this.current_cmd = null;
}

Proc.prototype.newpid = function() {
    return this._lastpid++;
};

Proc.prototype.add = function(pid, pipe) {
    this.proc[pid] = pipe;
};

Proc.prototype.rm = function(pid) {
    delete this.proc[pid];
};

Proc.prototype.current = function(cmd) {
    var cur = this.current_cmd;
    if (cmd !== undefined) {
        this.current_cmd = cmd;
    }
    return cur;
};

var proc = new Proc(); // Global process address space

function Command(opts) {
    var shell = opts ? opts.shell : null;

    this.opts = opts;
    if (shell) {
        this.shell = shell;
        this.cwd = $.extend(true, {}, shell.cwd);
    }
    this.fds = {
        'stdin': null,
        'stderr': null
    };
    this._buffer = [];
    this._obuffer = [];
    this.done = undefined;
    this.docopts = undefined;
    this._status = {};
    this._log = [];
    this._abortable = [];
}

Command.cmd_list = {};

Command.register = function(name, handler) {
    Command.cmd_list[name] = handler;
};

Command.unregister = function(name) {
    delete Command.cmd_list[name];
};

Command.lookup = function(name) {
    return Command.cmd_list[name];
};

Command.list = function() {
    return Object.keys(Command.cmd_list);
};

Command.prototype.DEBUG = true;


/* Signal upstream that you want more data to process */
Command.prototype.unext = check_soguard(function(opts, cb) {
    var self = this;
    if (self._buffer.length) {
        /* Consume item from buffer */
        return cb.call(self, null, self._buffer.shift());
    } else {
        if (self.fds.stdin) {
            proc.current(null);
            return self.fds.stdin.next(opts, check_live(function(err, res) {
                return cb.apply(self, arguments);
            }).bind(self));
        } else {
            return cb.call(self, null, null);
        }
    }
});

Command.prototype.next = function(opts, cb) {
    console.log("implement read_next!");
    return cb(null, null);
};

/* Emit output, buffering if necessary. check_next() drains buffer.  */
Command.prototype.output = function(res) {
    var nextcb = this._nextcb;
    if (!nextcb) {
        pdebug(this, "no nextcb on output!");
        this.kill("no nextcb on output!");
        return;
    }
    if (this._obuffer.length) {
        pdebug(this, "output() called when obuffer is non-empty!");
        this.kill("output() called when obuffer is non-empty!");
    } else {
        if (res instanceof Array) {
            this._obuffer = this._obuffer.concat(res);
        } else {
            this._obuffer.push(res);
        }
        var o = this._obuffer.shift();
        if (o === undefined) {
            o = null;
        }
        this._nextcb = undefined;
        proc.current(null);
        return nextcb(null, o);
   }
};

Command.prototype._output = function(res) {
    var nextcb = this._nextcb;

    this._nextcb = undefined;
    if (res === undefined) {
        pdebug(this, "output() undefined!");
        return;
    }
    if (nextcb) {
        proc.current(null);
        return nextcb(null, res);
    } else {
        pdebug(this, "no nextcb on _output!");
    }
};

/* Emit abort to stdout */
Command.prototype.abort = function(res) {
    var nextcb = this._nextcb;
    this.done = res;
    if (!nextcb) {
        pdebug(this, "no nextcb on output!");
    } else {
        this._nextcb = undefined;
        proc.current(null);
        return nextcb(res);
    }
};

/* Emit output to stderr */
Command.prototype.errmsg = function(err, str) {
    if (this.fds.stderr) {
        this.fds.stderr.append(err_stringify(err, str, this.usage) + '\n',
            {context: this}, function(){});
    } else {
        console.log('stderr: ', err_stringify(err, str, this.usage));
    }
};

function pdebug(cmd, str) {
    var cmdlist = [],
        e = new Error();
    while (cmd) {
        var name = (cmd.opts && cmd.opts.argv) ? cmd.opts.argv[0] : cmd._name ? cmd._name : 'unknown';
        cmdlist.push(name);
        cmd = cmd.fds.stdin;
    }
    console.log(cmdlist.join(',') + ': ' + str);
    console.log(e.stack);
}

/* Send EOF to downstream */
Command.prototype.eof = function() {
    return this.output(null);
};

function is_init(cmd) {
    return cmd && cmd.shell === cmd;
}

Command.prototype.exit = function(e) {
    if (!is_init(this)) {
        this.done = (e !== undefined && e !== null) ? e : true;
    }
    if (e && e !== true) {
        this.errmsg.apply(this, arguments);
    }
    if (!is_init(this)) {
        if (this._nextcb) {
            return this.eof();
        }
    }
};

Command.prototype.kill = function(reason) {
    if (this.done !== undefined) {
        pdebug(this, "Dead already?");
    }
    this._abortable.forEach(function(xhr) {
        xhr.abort();
    });
    this._abortable = [];
    reason = reason || 'killed';
    this._obuffer = [];
    return this.exit(reason);
};

/* Get my terminal. Equivalent to asking for /dev/tty. */
Command.prototype.pterm = function() {
    if (this.term) {
        return this.term;
    }

    var shell = this.shell;

    while (shell && shell.term === undefined && shell !== initshell) {
        shell = shell.shell;
    }
    return shell.term;
};

Command.prototype.pwd = function() {
    var self = this;
    return self.shell.ns.pwd(self.cwd.comps);
};

Command.prototype.getcwd = function() {
    var self = this;

    return fstack_top(self.cwd.cwd);
};

Command.prototype.chdir = function(path, cb) {
    var self = this,
        opts = {retcomps: true};

    sys.lookup(self, path, opts, ef(cb, function(res) {
        var dir = res[0],
            wdcomps = res[1];
        if (dir && isdir(dir)) {
            self.cwd = {cwd: fstack_base(dir), comps: wdcomps};
            return cb(null, self.cwd.cwd);
        } else {
            return cb(E('ENOTDIR'));
        }
    }));
};

/*
 * read() makes commands and files look alike. cb(exitstatus, [results])
 */

Command.prototype.read = function(opts, cb) {
    var self = this,
        sink = [];
    if (self.done !== undefined) {
        return cb(E('EPIPE'));
    }
    proc.current(self);
    function loop() {
        self.next(opts, ef(self, function(res) {
            if (res === null) {
                var err = (self.done === true) ? null : self.done;
                proc.current(null);
                return cb(err, sink);
            } else {
                sink.push(res);
            }
            loop();
        }));
    }
    loop();
};

function Shell(opts) {
    var self = this;

    Shell.base.call(self);
    self.opts = opts;
    self.ns = opts.ns;
    self.vars = {};
    self.argvars = {};
    self.functions = {};
    if (opts.argv[0] === 'init') { /* First shell */
        self.cwd = {cwd: self.ns.root, comps: [{name: '/', dir: self.ns.root}]};
        self.vars['?'] = ['true'];
        self.shell = self;
    } else {
        self.shell = opts.shell;
        self.cwd = $.extend(true, {}, self.shell.cwd);
    }
    self._status = 'start';
    self._exit_status = null;
    self._status_change = $.Callbacks();
    self.__defineGetter__('status', function() {
        return self._status;
    });
    self.__defineGetter__('exit_status', function() {
        return self._exit_status;
    });
    self.__defineSetter__('ctl', function(val) {
        return self.do_ctl(val);
    });
    self.__defineGetter__('cmdline', function() {
        return self.opts.argv.join(' ');
    });
    self._jfs = ['exit_status', 'status', 'ctl', 'cmdline'];
    self.pid = proc.newpid();

    proc.add(self.pid, self);
    
    //self.shell.vars['!'] = [self.pid.toString()];
}

inherit(Shell, Command);

Shell.prototype.getvars = function(varname) {
    var self = this;
    return (varname.match(/^[_0-9]+/) || varname === '*' || varname === '#') ? self.argvars : self.vars;
};

/*
 * Should do argument evaluation, including globbing, backquotes and variable
 * lookups
 */

Shell.prototype.arg_eval = check_live(function(arg, context, cb) {
    var self = this;

    if (isstring(arg)) {
        if (hasWildCard(arg)) {
            return self.glob(arg, function(err, res) {
                if (res && res.length === 0) {
                    return cb(err, arg);
                }
                return cb(err, res);
            });
        }
        return cb(null, arg);
    } else if (arg['SQUOTED_STRING'] !== undefined) {
        return cb(null, arg['SQUOTED_STRING']);
    } else if (arg['DQUOTED_STRING'] !== undefined) {
        return cb(null, arg['DQUOTED_STRING']);
    } else if (arg['HEREDOC'] !== undefined) {
        return cb(null, arg['HEREDOC']);
    } else if (arg['LIST'] !== undefined) {
        self.arglist_eval(arg['LIST'], context, cb);
    } else if (arg['VARVAL'] !== undefined) {
        var varval = arg['VARVAL'];
        if (varval instanceof Array) {
            var result = [],
                varname = varval[0],
                slist = varval[1],
                vars = self.getvars(varname);
            if (vars[varname] === undefined) {
                return cb(null, []);
            }
            self.arglist_eval(slist, context, function(err, arglist) {
                if (err) {
                    return cb(err);
                }
                for (var i = 0; i < arglist.length; i++) {
                    var arg = parseInt(arglist[i], 10);
                    if (isNaN(arg)) {
                        return cb('Non-numeric list index');
                    }
                    if (vars[varname][arg] !== undefined) {
                        result.push(vars[varname][arg]);
                    }
                }
                return cb(null, result);
            });
        } else {
            var vars = self.getvars(varval);
            if (vars[varval] === undefined) {
                return cb(null, []);
            }
            return cb(null, vars[varval]);
        }
    } else if (arg['VARLEN'] !== undefined) {
        var vars = self.getvars(arg['VARLEN']);
        if (vars[arg['VARLEN']] === undefined) {
            return cb(null, "0");
        }
        return cb(null, vars[arg['VARLEN']].length.toString());
    } else if (arg['VARJOIN'] !== undefined) {
        var vars = self.getvars(arg['VARJOIN']);
        if (vars[arg['VARJOIN']] === undefined) {
            return cb(null, '');
        }
        return cb(null, vars[arg['VARJOIN']].join(" "));
    } else if (arg['BACKQUOTE'] !== undefined) {
        var c = {'stdout': new Stdsink({shell: self}), 'stderr': context.stderr, 'stdin': context.stdin},
            subsh = new Shell({argv: ['sh', '-a', arg['BACKQUOTE']], shell: self}),
            p = makepipe(subsh, c);
            
        return p.read({}, ef(cb, function(res) {
            self.vars['?'] = [subsh.done.toString()];
            return cb(null, res);
        }));
    } else if (arg['DEFERRED'] !== undefined) {
        var shell = self;
        while (shell) {
            if (shell === shell.shell ||
                !(shell.docopts['-s'] || shell.docopts['-f'])) {
                break;
            }
            shell = shell.shell;
        }
        var subsh = new Shell({argv: ['sh', '-a', arg['DEFERRED']],
            shell: shell}),
            c = {'stdout': new StdDefOut({shell: shell}),
                'stderr': context.stderr},
            p = makepipe(subsh, c);
        return cb(null, p);
    } else if (arg['^']) {
        var leftarg = arg['^'][0],
            rightarg = arg['^'][1];

        concat_eval(leftarg, context, function(err, left) {
            if (err) {
                return cb(err);
            }
            concat_eval(rightarg, context, function(err, right) {
                if (err) {
                    return cb(err);
                }
                var result = [];
                if (left instanceof Array && right instanceof Array) {
                    if (left.length === 0) {
                        return concat_ret(right);
                    }
                    if (right.length === 0) {
                        return concat_ret(left);
                    }
                    if (left.length === 1) {
                        for (var i = 0; i < right.length; i++) {
                            result.push(left[0].toString() + right[i].toString());
                        }
                        return concat_ret(result);
                    } else if (right.length === 1) {
                        for (var i = 0; i < left.length; i++) {
                            result.push(left[i].toString() + right[0].toString());
                        }
                        return concat_ret(result);
                    }
                    if (left.length !== right.length) {
                        return cb('Improper concat of unequal lists');
                    }
                    for (var i = 0; i < left.length; i++) {
                        result.push(left[i].toString() + right[i].toString());
                    }
                    return concat_ret(result);
                }
                if (left instanceof Array) {
                    for (var i = 0; i < left.length; i++) {
                        result.push(left[i].toString() + right.toString());
                    }
                    return concat_ret(result);
                }
                if (right instanceof Array) {
                    for (var i = 0; i < right.length; i++) {
                        result.push(left.toString() + right[i].toString());
                    }
                    return concat_ret(result);
                }
                return concat_ret(left.toString() + right.toString());
            });
        });
    } else {
        return 'ARGEVAL_UNKNOWN';
    }

    function concat_eval(arg, context, cb) {
        if (isstring(arg)) {
            return cb(null, arg);
        } else {
            return self.arg_eval(arg, context, cb);
        }
    }
    function concat_ret(res) {
        if (isstring(res)) {
            return self.arg_eval(res, context, cb);
        } else if (res instanceof Array && res.length === 1 &&
            isstring(res[0])) {
            return self.arg_eval(res[0], context, cb);
        } else {
            return cb(null, res);
        }
    }

});

Shell.prototype.arglist_eval = check_live(function(args, context, done) {
    var self = this,
        arglist = [];

    async.forEachSeries(args, function(arg, acb) {
        self.arg_eval(arg, context, function(err, res) {
            if (err) {
                return acb(err); // bail out
            }
            if (res instanceof Array) {
                arglist = arglist.concat(res.map(function(r) {
                    return (typeof r === 'number') ? r.toString() : r;
                }));
            } else {
                arglist.push((typeof res === 'number') ? res.toString() : res);
            }
            return soguard(self, acb.bind(this, null));
        });
    },
    function(err) {
        return done(err, arglist);
    });
});

function makepipe(cmds, ctext) {
    cmds = (cmds instanceof Array) ? cmds : [cmds];

    var stdin = ctext.stdin,
        stderr = ctext.stderr,
        stdout = ctext.stdout;
    if (stdin) {
        cmds.push(stdin);
    }
    if (stdout) {
        cmds.unshift(stdout);
    }
    if (stderr) {
        for (var i = 0, max = cmds.length; i < max; i++) {
            var cmd = cmds[i];
            cmd.fds.stderr = stderr;
        }
    }
    for (var i = 0, max = cmds.length - 1; i < max; i++) {
        cmds[i].fds.stdin = cmds[i + 1];
    }
    return cmds[0];
}

/*
 * The heart of the shell. Evaluates the AST produced by the parser
 */

Shell.prototype.ast_eval = check_live(function(ast, context, cb) {
    var self = this;

    function do_cmdlist(tree, done) {
        var lastres = null;
        async.forEachSeries(tree, function(cmd, acb) {
            if (cmd === '') {
                return acb(null);
            }
            do_cmd(cmd, function(err, res) {
                if (err) {
                    self.errmsg(err, res);
                } else {
                    lastres = res;
                }
                return soguard(self, acb.bind(this, null));
            });
        },
        function(err) {
            return done(err, lastres);
        });
    }

    function iscmd(c) {
        return c instanceof Command || (c instanceof Array && c[0] instanceof Command);
    }
    function do_cmd(tree, done) {
        var ctext = $.extend({}, context);

        self.ast_eval(tree, ctext, function(err, res) {
            function do_next() {
                var opts = self.term ? {term: self.term} : {};
                self.pipe.next(opts, function(err, res) {
                    if (err) {
                        /* abort abort abort */
                        self.vars['?'] = [err_stringify(err)];
                        return self.exit(err);
                    }
                    if (res === null) {
                        /*
                         * End of this pipe, continue
                         */
                        var lastres = (self.pipe === ctext.stdout) ? self.pipe.fds.stdin.done : self.pipe.done;
                        if (lastres === undefined) {
                            pdebug(self.pipe, "command sent null but done not defined!");
                            lastres = false;
                        }
                        self.vars['?'] = [lastres.toString()];

                        return done(null, lastres);
                    } else {
                        return self.output(res);
                    }
                });
            }
            if (iscmd(res)) {
                self.pipe = makepipe(res, ctext, self);
                self._nextfunc = do_next;
                return do_next();
            } else if (err) {
                self.vars['?'] = ['false'];
                return done(err, res);
            } else {
                return done(err, res);
            }
        });
    }

    function andor(op) {
        /* Process  cmd && cmd, cmd || cmd */
        var left = ast[op][0],
            right = ast[op][1];

        do_cmd(left, function(err, res) {
            if (err || (res === true && op === 'OR') || (res !== true && op === 'AND')) {
                return cb(err, res);
            }
            do_cmd(right, cb);
        });
    }

    if (ast instanceof Array) {
        return do_cmdlist(ast, cb);
    }
    
    /*
     * If you ever get errors due to ast being undefined (Could not find
     * 'TAIL' of undefined), it is usually because multiple callbacks are
     * being issued for loop iteration, causing async.forEachSeries to go
     * beyond the end of the list. Remember that Pipeline.kill has the
     * side effect of calling the pipe callback.
     */

    var tail = ast['TAIL'];
    if (tail) {
        var redir = {};
        async.forEachSeries(tail, function(t, acb) {
            function process_redir(rtype, restype, rclass, opts) {
                self.arg_eval(t[rtype], context, function(err, res) {
                    if (err) {
                        return cb(err);
                    }
                    if (res instanceof Array) {
                        if (res.length != 1) {
                            return cb('Invalid expression for redir');
                        } else {
                            res = res[0];
                        }
                    }
                    redir[restype] = new rclass(opts, res);
                    if (rtype === 'REDIR2OUT' || rtype === 'REDIR2APPEND') {
                        redir[restype].init(ef(cb, function() {
                            return acb(null);
                        }));
                    } else {
                        return acb(null);
                    }
                });
            }
            if (t['REDIROUT'] !== undefined) {
                process_redir('REDIROUT', 'OUT', RedirOut, {shell: self});
            } else if (t['REDIRAPPEND'] !== undefined) {
                process_redir('REDIRAPPEND', 'OUT', RedirAppend, {shell: self});
            } else if (t['REDIR2OUT'] !== undefined) {
                process_redir('REDIR2OUT', 'OUT2', RedirStderr, {shell: self, overwrite: true});
            } else if (t['REDIR2APPEND'] !== undefined) {
                process_redir('REDIR2APPEND', 'OUT2', RedirStderr, {shell: self});
            } else if (t['REDIRIN'] !== undefined) {
                process_redir('REDIRIN', 'IN', RedirIn, {shell: self});
            } else {
                return cb('unknown tail', null);
            }
        },
        function(err) {
            if (redir['OUT'] === undefined && redir['IN'] === undefined &&
                redir['OUT2'] === undefined) {
                return cb('tail error');
            }
            if (redir['OUT2']) {
                context.stderr = redir['OUT2'];
            }
            if (redir['OUT']) {
                context.stdout = redir['OUT'];
            }
            if (redir['IN']) {
                context.stdin = redir['IN'];
            }
            return main();
        });
    } else {
        main();
    }

    function main() {
        if (ast === '') {
            return cb(null, null);
        }
        if (ast['ARGLIST']) {
            self.arglist_eval(ast['ARGLIST'], context, function(err, res) {
                if (err) {
                    return cb(err);
                }
                return self.find_cmd(res, cb);
            });
        } else if (ast['PIPE']) {
            var cmdlist = [];
            async.forEachSeries(ast['PIPE'], function(cmd, acb) {
                self.ast_eval(cmd, context, function(err, res) {
                    if (err) {
                        return acb(err);
                    }
                    cmdlist.unshift(res);
                    return acb(null); // next command
                });
            },
            function(err) {
                if (err) {
                    return cb(err);
                }
                return cb(null, cmdlist);
            });
        } else if (ast['ASSIGN']) {
            var asslist = [];
            for (var a in ast['ASSIGN']) {
                asslist.push([a, ast['ASSIGN'][a]]);
            }
            async.forEachSeries(asslist, function(ass, acb) {
                var variable = ass[0],
                    value = ass[1],
                    vars = self.getvars(variable);
                self.arg_eval(value, context, function(err, res) {
                    if (err) {
                        return acb(err);
                    }
                    if (res instanceof Array) {
                        vars[variable] = res;
                    } else {
                        vars[variable] = [res];
                    }
                    return acb(null);
                });
            },
            function(err) {
                return cb(err, null);
            });
        } else if (ast['RETURN'] !== undefined) {
            var retval = ast['RETURN'];
            if (!retval) {
                return self.byebye();
            }
            self.arg_eval(retval, context, function(err, res) {
                if (err) {
                    return cb(err);
                }
                return self.byebye(res);
            });
        } else if (ast['AND'] || ast['OR']) {
            var op = ast['AND'] ? 'AND' : 'OR';
            return andor(op);
        } else if (ast['IF']) {
            var ifblocks = ast['IF'][0],
                elseblock = ast['IF'][1];

            async.forEachSeries(ifblocks, function(ifblock, acb) {
                var ifnot = (ifblock[0] === 'IFNOT'),
                    condition = ifblock[1],
                    then = ifblock[2];

                do_cmd(condition, function(err, res) {
                    res = (res === true) ? true : false;
                    res = (ifnot === true) ? !res : res;
                    if (err) {
                        return acb(err);
                    }
                    if (res !== true) {
                        return acb(null);
                    }
                    do_cmdlist(then, cb);
                });
            },
            function(err) {
                if (err) {
                    return cb(err);
                }
                if (elseblock.length === 0) {
                    return cb(null, null);
                }
                do_cmdlist(elseblock, cb);
            });
        } else if (ast['FOR']) {
            var tree = ast['FOR'],
                iterator = tree[0],
                arglist = tree[1]['ARGLIST'],
                body = tree[2];

            self.arglist_eval(arglist, context, function(err, res) {
                if (err) {
                    return cb(err);
                }
                var lastres = null;
                async.forEachSeries(res, function(arg, acb) {
                    self.vars[iterator] = [arg];
                    do_cmdlist(body, function(err, res) {
                        if (!err) {
                            lastres = res;
                        }
                        return soguard(self, acb.bind(this, null));
                    });
                },
                function(err) {
                    return cb(err, lastres);
                });
            });
        } else if (ast['WHILE']) {
            var tree = ast['WHILE'],
                condition = tree[0],
                body = tree[1],
                do_while;
            do_while = function() {
                do_cmd(condition, function(err, res) {
                    if (err || res !== true) {
                        return cb(err, res);
                    }
                    do_cmdlist(body, function(err, res) {
                        if (err) {
                            return cb(err);
                        } else {
                            return soguard(self, do_while);
                        }
                    });
                });
            };
            return do_while();
        } else if (ast['FUNCTION']) {
            var tree = ast['FUNCTION'],
                funcname = tree[0],
                body = tree[1];
            if (body === null) {
                delete self.functions[funcname];
                return cb(null, null);
            }
            self.functions[funcname] = body;
            return cb(null, null);
        }
    }
});

Shell.prototype.do_ctl = function(val) {
    var self = this,
        op = val.split(/\s/)[0];

    if (op === 'stop' && self._status === 'start') {
        self._status = 'stop';
        self._status_change.fire('stop');
    } else if (op === 'start' && (self._status === 'init' || self._status === 'stop')) {
        self._status = 'start';
        self._status_change.fire('start');
    } else if (op === 'kill' && self._status !== 'done') {
        self._status = 'done';
        self.kill('killed');
    }
};

Shell.prototype.find_cmd = function(arglist, cb) {
    var self = this,
        cmdname = arglist.shift();

    if (self.functions[cmdname] !== undefined) {
        arglist.unshift('sh', '-f', cmdname, '--');
        var cmd = new Shell({argv: arglist, shell: self});
        return cb(null, cmd);
    }
    var builtin_cmd = (cmdname === 'sh') ? Shell : Command.lookup(cmdname);
    if (builtin_cmd !== undefined) {
        arglist.unshift(cmdname);
        var cmd = new builtin_cmd({argv: arglist, shell: self});
        return cb(null, cmd);
    }

    if (cmdname.match(/\//)) {
        arglist.unshift('sh', cmdname, '--');
        var cmd = new Shell({argv: arglist, shell: self});
        return cb(null, cmd);
    }

    function find_cmd_path(path, cmdname, cb) {
        self.ns.lookup(pathjoin(path, cmdname), {}, function(err, res) {
            if (err) {
                return cb('Command not found: ' + cmdname, null);
            }
            arglist.unshift('sh', pathjoin(path, cmdname), '--');
            var cmd = new Shell({argv: arglist, shell: self});
            return cb(null, cmd);
        });
    }

    var paths = self.vars['PATH'] || ['/bin'];
    async.forEachSeries(paths, function(path, acb) {
        find_cmd_path(path, cmdname, function(err, res) {
            if (res) {
                return cb(null, res);
            }
            return soguard(self, acb.bind(this, null));
        });
    },
    function(err) {
        return cb('Command not found: ' + cmdname);
    });
};

Shell.prototype.glob = function(string, cb) {
    var self = this,
        globcomps = string.split('/');
    if (globcomps.length > 1 && globcomps[0] === '') {
        self.glob_process('/', globcomps.slice(1), cb);
    } else {
        self.glob_process('', globcomps, cb);
    }

};

Shell.prototype.glob_process = check_live(function(path, globcomps, cb) {
    var self = this;

    if (globcomps.length === 0) {
        return cb(null, []);
    }

    var comp = globcomps[0] || '/';
    if (comp === '.' || comp === '..' || comp === '/') {
        return self.glob_process(pathjoin(path, comp), globcomps.slice(1), cb);
    }
    sys.search(self, pathjoin(path, comp), {}, function (err, res) {
        if (err || !res || res.length === 0) {
            return cb(null, []);
        }
        var nextlevel = res.map(function(entry) {
            return [pathjoin(path, entry[0]), isdir(entry[1])];
        });
        if (globcomps.length === 1) {
            return cb(null, nextlevel.map(function(e) { return e[0]; }));
        }
        var gatherlist = [];
        async.forEachSeries(nextlevel, function(nextpath, acb) {
            if (nextpath[1]) {
                self.glob_process(nextpath[0], globcomps.slice(1),
                    function(err, res) {
                    gatherlist = gatherlist.concat(res);
                    return soguard(self, acb.bind(this, null));
                });
            } else {
                return soguard(self, acb.bind(this, null));
            }
        },
        function(err) {
            return cb(err, gatherlist);
        });
    });
});

Shell.prototype.usage = 'sh           -- run a given script\n\n' +
    'Usage:\n' +
    '    sh [-spt] <file> [<arg>...]\n' +
    '    sh [-spt] -c <string>\n' +
    '    sh [-s] -a <ast>\n' +
    '    sh -f <func> [<arg>...]\n' +
    '    sh -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    <file>       Script file.\n' +
    '    -c <string>  Command line.\n' +
    '    <file>       Source file.\n' +
    '    -f <func>    Run function (internal use).\n' +
    '    -a <ast>     Run AST (internal use).\n' +
    '    -p           Parse and emit AST (internal use).\n' +
    '    <arg>        Arguments to the shell command.\n';

Shell.prototype.next = check_next(do_docopt(function(opts, cb) {
    var self = this,
        srcfile = self.docopts['<file>'],
        srcstr = self.docopts['-c'],
        func = self.docopts['-f'],
        ast = self.docopts['-a'];

    function parse_run(str) {
        var p = self.parse(str);
        if (p[0] === null) {
            if (self.docopts['-p']) {
                self.done = true;
                return self.output(p[1]);
            } else {
                return self.run(p[1]);
            }
        } else {
            return self.exit(p[0]);
        }
    }

    function init() {
        var args = self.docopts['<arg>'].slice(1),
            name = srcfile || func;

        if (self.docopts['-t']) {
            self.start_time = Date.now();
        }
        if (opts.term) {
            self.term = opts.term;
        }
        //console.log("new shell", self.pid, "parent: ", self.shell.pid, self.opts.argv.join(' '), "term: ", self.term ? self.term.name : "none", "pterm: ", self.pterm() ? self.pterm().name : "none");
        if (self.docopts['-s'] || self.docopts['-f']) {
            /* execute in same context */
            self.vars = self.shell.vars;
            self.ns = self.shell.ns;
            self.functions = self.shell.functions;
        } else {
            self.ns = $.extend(true, {}, self.shell.ns);
            self.vars = $.extend(true, {}, self.shell.vars);
            self.functions = $.extend(true, {}, self.shell.functions);
            self.vars['?'] = ['true'];
            if (self.docopts['-a']) {
                for (var i in self.shell.argvars) {
                    if (i.match(/^([0-9]+|\*|\?)/)) {
                        self.argvars[i] = $.extend(true, [], self.shell.argvars[i]);
                    }
                }
            }
        }

        if (!self.docopts['-a']) {
            if (name) {
                args.unshift(name);
            }
            self._setargvars(args);
        }
        if (srcstr) {
            return parse_run(srcstr);
        }
        if (func) {
            return self.run(self.shell.functions[func]);
        }
        if (ast) {
            return self.run(ast);
        }
        fread.call(self, srcfile, function(err, res) {
            if (err) {
                return self.exit(err, srcfile);
            }
            to('text', res, {}, function(err, res) {
                if (err) {
                    return self.exit(err, srcfile);
                }
                return parse_run(res);
            });
        });
    }

    if (self.inited === undefined) {
        self.inited = true;
        return init();
    }
    return self._nextfunc();
}));

Shell.prototype._setargvars = function(args) {
    var self = this;

    for (var i = 0; i < args.length; i++) {
        self.argvars[i] = [args[i]];
    }
    self.argvars['*'] = args.slice(1);
    var nargs = (args.length > 1) ? args.length - 1: 0;
    self.argvars['#'] = [nargs.toString()];
};

Shell.prototype.kill = function(reason) {
    var self = this,
        cmd = self.pipe;
    
    if (self.done !== undefined) {
        pdebug(this, "you only die once");
        return;
    }
    while (cmd && cmd !== self.fds.stdin) {
        cmd.kill('parent shell killed');
        cmd = cmd.fds.stdin;
    }
    self._abortable.forEach(function(xhr) {
        xhr.abort();
    });
    self._abortable = [];
    reason = reason || 'killed';
    return self.exit(reason);
};

Shell.prototype.exit = function(e) {
    if (!is_init(this) && this.done === undefined) {
        this.done = (e !== undefined && e !== null) ? e : true;
    }
    if (e && e !== true) {
        this.errmsg.apply(this, arguments);
    }
    if (!is_init(this)) {
        this._status = 'done';
        this._status_change.fire('done');
        proc.rm(this.pid);
        if (this._nextcb) {
            return this.eof();
        }
    }
};

Shell.prototype.byebye = function(exitval) {
    var self = this;

    if (exitval === undefined || exitval === null) {
        exitval = self.vars['?'][0];
    }
    if (exitval instanceof Array) {
        exitval = exitval[0];
    }
    if (exitval === 'true') {
        exitval = true;
    } else if (exitval === 'false') {
        exitval = false;
    }

    self.done = exitval;
    return self.exit();
};

Shell.prototype.builtin_exit = function(exitval) {
    var self = this;

    if (self.docopts !== undefined && (self.docopts['-f'])) {
        /* Merely a subshell of convenience, should affect parent */
        return self.shell.builtin_exit(exitval);
    }
    return self.byebye(exitval);
};

Shell.prototype.builtin_shift = function(num) {
    var self = this,
        args = self.argvars['*'].slice(num);

    args.unshift(self.argvars[0]);
    self._setargvars(args);
    return;
};

Shell.prototype.parse = function(str, srcfile) {
    var self = this,
        ast;

    try {
        ast = parser.parse(str);
    } catch (e) {
        return [parse_error(str, e), null];
    }
    //console.log(ast);
    return [null, ast];
};

Shell.prototype.run = function(ast) {
    var self = this;

    var context = {stdin: self.fds.stdin, stderr: self.fds.stderr};
    //try {
        self.ast_eval(ast, context, function(err, res) {
            if (self.docopts['-t']) {
                var now = Date.now();
                self.errmsg('Elapsed: ' + (now - self.start_time) / 1000.0 + 's');
            }

            if (err) {
                return self.exit(err);
            } else {
                return self.byebye(res);
            }
        });
   // } catch(e) {
   //     console.log("CURRENT", proc.current());
   //     console.log('Exception: ' + e.message);
   //     console.log(e.stack);
   //     return self.exit('Exception: ' + e.message);
   // }
};

function OCommand(opts) {
    OCommand.base.call(this, opts);
}

inherit(OCommand, Command);

OCommand.prototype.kill = function() {
    //pdebug(this, "ocommand kill");
    OCommand.base.prototype.kill.apply(this, arguments);
};

OCommand.prototype.exit = function() {
    //pdebug(this, "ocommand exit");
    OCommand.base.prototype.exit.apply(this, arguments);
};

function Stdout(opts, term) {
    var self = this;
    self.term = term;
    Stdout.base.call(self, opts);
    self._name = "Stdout";
}

inherit(Stdout, OCommand);


Stdout.prototype.next = check_next(function(opts, cb) {
    var self = this,
        opts = self.term instanceof Pterm ? { term: self.term } : {};

    function loop() {
        self.unext(opts, cef(self, function(res) {
            if (res !== null) {
                self.term.append(res, {}, function(err, res) {
                    if (err) {
                        console.log(err);
                    }
                    loop();
                });
            } else {
                return self.exit();
            }
        }));
    }
    loop();
});

function Stdin(opts, term) {
    var self = this;
    Stdin.base.call(self, opts);
    self._name = "Stdin";
    self.term = term;
}

inherit(Stdin, OCommand);

Stdin.prototype.next = check_next(function() {
    var self = this;

    if (self.cli !== undefined) {
        return;
    }

    var clidiv = $('<div/>');
    self.term.div.append(clidiv);
    self.cli = new Readline({prompt: '', input: self.cli_input.bind(self), keydown: self.keydown.bind(self)}, clidiv);
});

Stdin.prototype.cli_input = function(lines) {
    var self = this,
        cli = self.cli;

    cli.deactivate();
    self.cli = undefined;
    self.output(lines);
};

Stdin.prototype.keydown = function(e) {
    var self = this,
        term = self.term,
        cli = self.cli;

    if (cli.cm_mode !== 'line') {
        return true;
    }

    if (e.which === 67 && e.ctrlKey) { /* ctrl-c */
        proc.proc[self.shell.pid].ctl = 'kill';
        return false;
    }
    if (e.which === 90 && e.ctrlKey) { /* ctrl-z */
        proc.proc[self.shell.pid].ctl = 'stop';
        return false;
    }

    if (e.which === 68 && e.ctrlKey) { /* ctrl-d */
        var line = cli.line();
        if (line === '') {
            cli.deactivate();
            self.cli = undefined;
            self.done = true;
            self.eof();
        }
        return false;
    }
    return true;
};

/*
 * A Stdout-like object for capturing output from command substitutions.
 * If the output is a string, will split by newline, eliminate empty lines
 * to approximate bash-like behaviour.
 * TODO Consider making this split by an IFS.
 *
 * Non-strings will be passed through as-is.
 */

function Stdsink(opts) {
    var self = this;

    Stdsink.base.call(self, opts);
    self._name = "Stdsink";
    self.sink = [];
}

inherit(Stdsink, OCommand);

Stdsink.prototype.next = check_next(function() {
    var self = this;

    function loop() {
        self.unext({}, cef(self, function(res) {
            if (res === null) {
                self.done = true;
                return self.output(self.sink);
            } else if (isstring(res)) {
                res = res.trim();
                if (res !== '') {
                    self.sink.push(res);
                }
            } else {
                self.sink.push(res);
            }
            loop();
        }));
    }
    loop();
});

/*
 * A Stdout-like object tacked on to the end of 'deferred' pipes. Does two
 * things: makes sure that the next()  method of deferred pipes returns one
 * object (not a list), due to inherent inability of the next command to
 * maintain iterator context across invocations. Second, return EPIPE when
 * reading on an exhausted pipe.
 */

function StdDefOut(opts) {
    var self = this;

    StdDefOut.base.call(self, opts);
    self._name = "StdDefOut";
}

inherit(StdDefOut, Command);

StdDefOut.prototype.next = function(opts, cb) {
    var self = this;

    if (self.done !== undefined) {
        return cb(E('EPIPE'));
    }
    self.unext({}, function(err, res) {
        if (err) {
            self.done = err;
            return cb(err);
        }
        if (res === null) {
            self.done = true;
        }
        return cb(null, res);
    });
};

function RedirIn(opts, target) {
    var self = this;

    RedirIn.base.call(self, opts);
    self._name = "RedirIn";
    self.target = target;
    self.index = 0;
}

inherit(RedirIn, OCommand);

RedirIn.prototype.next = check_next(function() {
    var self = this;

    if (self.target instanceof Array) {
        var i = self.index;
        if (i >= self.target.length) {
            return self.exit();
        }
        self.index++;
        return self.output(self.target[i]);
    } else if (!isstring(self.target)) {
        return self.exit("Invalid target for RedirIn");
    }

    fread.call(self, self.target, function(err, res) {
        if (err) {
            return self.exit(err, self.target);
        }
        self.done = true;
        return self.output(res);
    });
});

function RedirOut(opts, target) {
    var self = this;

    RedirOut.base.call(self, opts);
    self._name = "RedirOut";
    self.target = target;
    self.targetdir = null;
    self.sink = [];
}

inherit(RedirOut, OCommand);

RedirOut.prototype.next = check_next(function() {
    var self = this;

    if (self.targetdir === null) {
        var comps = pathsplit(self.target),
            last = comps[1],
            parentdir = comps[0];
        
        sys.lookup(self, parentdir, {}, function(err, res) {
            if (err) {
                return self.exit(err, parentdir);
            }
            if (res.putdir) {
                self.targetdir = res;
                self.targetfilename = last; 
                return more();
            } else {
                return self.exit(E('ENOSYS'), parentdir);
            }
        });
    } else {
        return more();
    }

    function more() {
        self.unext({}, cef(self, function(obj) {
            if (obj !== null) {
                self.sink.push(obj);
                return more();
            } else {
                sys.putdir(self, self.targetdir, self.targetfilename,
                    self.sink, {}, function(err, res) {
                    return self.exit(err, self.targetfilename);
                });
            }
        }));
    }
});

function RedirAppend(opts, target) {
    var self = this;

    RedirAppend.base.call(self, opts);
    self._name = "RedirAppend";
    self.target = target;
    self.targetfile = null;
}

inherit(RedirAppend, OCommand);

RedirAppend.prototype.next = check_next(function() {
    var self = this;

    if (self.targetfile !== null) {
        return next();
    } else {
        touchfile(self, self.target, {}, function(err, res) {
            if (err) {
                return self.exit(err, res);
            }
            if (fstack_top(res[1]).append) {
                self.targetfile = res[1];
                self.parentdir = res[0];
            } else {
                return self.exit(E('ENOSYS'), self.target);
            }
            return next();
        });
    }

    function next() {
        self.unext({}, cef(self, function(obj) {
            if (obj === null) {
                return self.exit();
            } else {
                sys.append(self, fstack_top(self.targetfile), obj, {},
                    function(err, res) {
                    if (err) {
                        return self.exit(err, self.target);
                    }
                    fstack_invaldir(fstack_top(self.parentdir)); // Hack to update file size in ls
                    return next();
                });
            }
        }));
    }
});

function RedirStderr(opts, target) {
    var self = this;

    self._name = "RedirStderr";
    self.opts = opts;
    self.shell = opts.shell;
    self.cwd = self.shell.cwd;
    self.target = target;
    self.targetfile = null;
}

inherit(RedirStderr, OCommand);

RedirStderr.prototype.init = function(cb) {
    var self = this;

    touchfile(self, self.target, {overwrite: self.opts.overwrite}, ef(cb, function(res) {
        if (fstack_top(res[1]).append) {
            self.targetfile = res[1];
            self.parentdir = res[0];
            return cb(null, null);
        } else {
            return cb(E('ENOSYS'), self.target);
        }
    }));
};

RedirStderr.prototype.append = function(obj, opts, cb) {
    var self = this;

    return sys.append(self, fstack_top(self.targetfile), obj, {}, ef(cb, function() {
        fstack_invaldir(fstack_top(self.parentdir)); // Hack to update file size in ls
        return cb(null, null);
    }));
};

function touchfile(cmd, path, opts, cb) {
    var self = this,
        comps = pathsplit(path),
        last = comps[1],
        ppath = comps[0],
        pdb;
    
    sys.lookup(cmd, ppath, {}, function(err, parentdir) {
        if (err) {
            return cb(err, ppath);
        }
        pdb = fstack_base(parentdir);
        sys.lookup(cmd, path, {}, function(err, res) {
            if (err || opts.overwrite) {
                if (err && err.code !== 'ENOENT') {
                    return cb(err, path);
                }
                sys.putdir(cmd, parentdir, last, [''], {}, function(err, res) {
                    if (err) {
                        return cb(err, path);
                    }
                    sys.lookup(cmd, path, {}, function(err, res) {
                        if (err) {
                            return cb(err, path);
                        }
                        return cb(null, [pdb, fstack_base(res)]);
                    });
                });
            } else {
                return cb(null, [pdb, fstack_base(res)]);
            }
        });
    });
}

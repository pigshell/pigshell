/* Copyright (C) 2012 by Coriolis Technologies Pvt Ltd. All rights reserved. */
function Proc() {
    this.proc = {};
    this._lastpid = 1;
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

var proc = new Proc(); // Global process address space
VFS.init();

function Shell(opts) {
    var self = this;

    Shell.base.call(self);
    self.opts = opts;
    self.ns = opts.ns;
    self.vars = {};
    self.argvars = {};
    self.pipes = {};
    self.functions = {};
    self.cout = null;
    self.cin = null;
    if (opts.argv[0] === 'init') { /* First shell */
        self.cwd = {cwd: self.ns.root, comps: [{name: '/', dir: self.ns.root}]};
        self.shell = self;
    }
    self.more_handler(self.more_next.bind(self));
    self.input_handler(self.input_next.bind(self));
    self.tabstate = 0;
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

Shell.prototype.arg_eval = sh_check_live(function(arg, context, cb) {
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
                    result.push(vars[varname][arg]);
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
        var c = {'stdout': new Stdsink({}), 'stderr': context.stderr, 'stdin': context.stdin, 'term': context.term};
        self.ast_eval(arg['BACKQUOTE'], c, function(err, res) {
            if (err) {
                return cb(err);
            }
            return cb(null, c.stdout.sink);
        });
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

Shell.prototype.arglist_eval = sh_check_live(function(args, context, done) {
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

/*
 * The heart of the shell. Evaluates the AST produced by the parser
 */

Shell.prototype.ast_eval = sh_check_live(function(ast, context, cb) {
    var self = this;

    function do_cmdlist(tree, done) {
        var lastres = null;
        async.forEachSeries(tree, function(cmd, acb) {
            if (cmd === '') {
                return acb(null);
            }
            do_cmd(cmd, function(err, res) {
                if (err) {
                    context.stderr.fds.stdin.data.fire(err);  
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

    function do_cmd(tree, done) {
        var ctext = $.extend({}, context);

        if (context.killed !== undefined) {
            return done(context.killed);
        }
            
        self.ast_eval(tree, ctext, function(err, res) {
            if (iscmd(res)) {
                var pipe = new Pipeline(res, ctext, self);
                self.pipes[pipe.pid] = pipe;
                return pipe.run(function(err, res) {
                    delete self.pipes[pipe.pid];
                    return done(err, res);
                });
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
                    return acb(null);
                });
            }
            if (t['REDIROUT'] !== undefined) {
                process_redir('REDIROUT', 'OUT', RedirOut, {});
            } else if (t['REDIRAPPEND'] !== undefined) {
                process_redir('REDIRAPPEND', 'OUT', RedirAppend, {});
            } else if (t['REDIR2OUT'] !== undefined) {
                process_redir('REDIR2OUT', 'OUT2', RedirAppend, {stderr: true, overwrite: true});
            } else if (t['REDIR2APPEND'] !== undefined) {
                process_redir('REDIR2APPEND', 'OUT2', RedirAppend,
                    {stderr: true});
            } else if (t['REDIRIN'] !== undefined) {
                process_redir('REDIRIN', 'IN', RedirIn);
            } else {
                return cb('unknown tail', null);
            }
        },
        function(err) {
            if (redir['OUT'] === undefined && redir['IN'] === undefined &&
                redir['OUT2'] === undefined) {
                return cb('tail error');
            }
            var olderr = context.stderr;
            if (redir['OUT2']) {
                redir['OUT2'].fds.stderr.data.add(function(arg) {
                    olderr.fds.stdin.data.fire(arg);
                });
                context.stderr = redir['OUT2'];
            }
            if (redir['OUT']) {
                redir['OUT'].fds.stderr.data.add(function(arg) {
                    olderr.fds.stdin.data.fire(arg);
                });
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

Shell.prototype.find_cmd = function(arglist, cb) {
    var self = this,
        cmdname = arglist.shift();

    if (self.functions[cmdname] !== undefined) {
        arglist.unshift('sh', '-f', cmdname, '--');
        var cmd = new Shell({argv: arglist});
        return cb(null, cmd);
    }
    var builtin_cmd = (cmdname === 'sh') ? Shell : Command.lookup(cmdname);
    if (builtin_cmd !== undefined) {
        arglist.unshift(cmdname);
        var cmd = new builtin_cmd({argv: arglist});
        return cb(null, cmd);
    }

    if (cmdname.match(/\//)) {
        arglist.unshift('sh', cmdname, '--');
        var cmd = new Shell({argv: arglist});
        return cb(null, cmd);
    }

    function find_cmd_path(path, cmdname, cb) {
        self.ns.lookup(pathjoin(path, cmdname), {}, function(err, res) {
            if (err) {
                return cb('Command not found: ' + cmdname, null);
            }
            arglist.unshift('sh', pathjoin(path, cmdname), '--');
            var cmd = new Shell({argv: arglist});
            return cb(null, cmd);
        });
    }

    find_cmd_path('/bin', cmdname, function(err, res) {
        if (res) {
            return cb(null, res);
        }
        find_cmd_path('/local', cmdname, cb);
    });
};

/* Used by tab completion */
Shell.prototype.find_cmd_matches = function(cmd, cb) {
    var self = this,
        re = new RegExp('^' + cmd),
        matches = [];

    matches = Object.keys(self.functions).filter(function(c) { return re.test(c);});
    matches = matches.concat(Command.list().filter(function(c) { return re.test(c);}));

    self.search('/bin/' + cmd + '*', {}, function(err, res) {
        if (!err) {
            res = res.map(function(c) { return c[0];});
            matches = matches.concat(res);
        }
        self.search('/local/' + cmd + '*', {}, function(err, res) {
            if (!err) {
                res = res.map(function(c) { return c[0];});
                matches = matches.concat(res);
            }
            return cb(null, uniq(matches));
        });
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

Shell.prototype.glob_process = sh_check_live(function(path, globcomps, cb) {
    var self = this;

    if (globcomps.length === 0) {
        return cb(null, []);
    }

    var comp = globcomps[0] || '/';
    if (comp === '.' || comp === '..' || comp === '/') {
        return self.glob_process(pathjoin(path, comp), globcomps.slice(1), cb);
    }
    self.search(pathjoin(path, comp), {}, function (err, res) {
        if (!res || res.length === 0) {
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

/*
 * "Lower" part of the shell - deals with grubby things like terminals and
 * tab completion
 */

Shell.prototype.usage = 'sh           -- run a given script\n\n' +
    'Usage:\n' +
    '   sh [-t] <file> [<arg>...]\n' +
    '    sh [-t] -c <string> [<arg>...]\n' +
    '    sh -s <file>\n' +
    '    sh -f <func> [<arg>...]\n' +
    '    sh -i\n' +
    '    sh -h | --help\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    <file>       Script file.\n' +
    '    -c <string>  Command line.\n' +
    '    -s <file>    Source file.\n' +
    '    -f <func>    Run function.\n' +
    '    -i           Interactive shell.\n' +
    '    <arg>        Arguments to the shell command.\n';

Shell.prototype.more_next = check_live(do_docopt(function() {
    var self = this,
        srcfile = self.docopts['-s'] || self.docopts['<file>'],
        srcstr = self.docopts['-c'],
        func = self.docopts['-f'];

    function init() {
        if (self.docopts['-i']) {
            var newdiv = $('<div style="z-index:4; position: absolute; width: 400px; height: 300px; right: 160px; top: 0"/>');
            $('#main').prepend(newdiv);
            var term = new Pterm({move: false}, termfs.root, newdiv);
            return self.interactive({}, term);
        }
        if (self.docopts['-t']) {
            self.start_time = Date.now();
        }
        if (srcstr) {
            return self.parse(srcstr);
        }
        if (func) {
            return self.run(self.shell.functions[func], func);
        }
        fread.call(self, srcfile, function(err, res) {
            if (err) {
                return self.exit(err, srcfile);
            }
            to('text', res, {}, function(err, res) {
                if (err) {
                    return self.exit(err, srcfile);
                }
                return self.parse(res, srcfile);
            });
        });
    }

    if (self.inited === undefined) {
        self.inited = true;
        return init();
    }
    return self.cout.fds.stdout.signal.fire();
}));

Shell.prototype.kill = function(reason) {
    var self = this,
        pipes = $.extend({}, self.pipes);
    
    self.done = reason;
    for (var pid in pipes) {
       pipes[pid].kill(reason);
    }
};

/* Interactive shell, usually first thing to be run. No enclosing pipeline! */
Shell.prototype.interactive = function(opts, term) {
    var self = this;
    self.term = term;
    if (!opts.quiet) {
        self.term.append(self.motd());
    }
    self.addcli();
    self.history = new History(opts, self);
    self.vars['?'] = ['true'];
    self.interactive_shell = true;
    self.icmd_fg = null;
    self.icmd_bg = [];
};

Shell.prototype.addcli = function() {
    var self = this;

    var clidiv = $('<div/>');
    self.term.div.append(clidiv);
    self.cli = new Readline({prompt: '>', keydown: self.keydown.bind(self), input: self.cli_input.bind(self)}, clidiv);
    rescroll(self.term.div);
};

Shell.prototype.cli_input = function(cmd) {
    var self = this,
        cli = self.cli,
        term = self.term,
        newdiv = $('<div/>'),
        newterm;
        
    self.tabstate = 0;
    if (self.td_div) {
        self.td_div.remove();
        self.td_div = undefined;
    }
    if (cmd.indexOf("#nohistory") === -1) {
        self.history.add(cmd);
    }
    cli.deactivate();
    newterm = new Pterm({}, term, newdiv);
    self.addcli();
    self.history._halfdone = undefined;

    var icmd = { cli: cli, term: newterm, cmd: cmd };
    self.icmd_bg.push(icmd);
    self.run_next();
    return false;
};

Shell.prototype.run_next = function() {
    var self = this,
        pwd = self.cwd.comps[self.cwd.comps.length - 1].name;

    if (self.icmd_fg) {
        return;
    }
    
    var icmd = self.icmd_bg.shift();
    if (!icmd) {
        self.cli.prompt('pig:' + pwd + '$ ');
        return;
    }

    var term = icmd.term,
        cmd = icmd.cmd,
        cli = icmd.cli,
        ast;

    cli.prompt('pig:' + pwd + '$ ');
    try {
        ast = parser.parse(cmd);
        //console.log(ast);
    } catch (e) {
        console.log(parse_error(cmd, e));
        term.append(parse_error(cmd, e));
    }
    if (!ast) {
        return self.run_next();
    }
    var context = {
        stdout: new Stdout({}, term),
        stderr: new Stderr({}, term),
        stdin: new Stdin({}, term),
        notify: new Pnotify({}, cli),
        term: term};
    icmd.context = context;
    self.icmd_fg = icmd;
    try {
        self.ast_eval(ast, context, function(err, res) {
            if (err) {
                term.append(err.toString());
            }
            if (self.icmd_fg === icmd) {
                self.icmd_fg = null;
                return self.run_next();
            }
        });
    } catch(e) {
        term.append('Exception: ' + e.message);
        console.log(e.stack);
        if (self.icmd_fg === icmd) {
            self.icmd_fg = null;
            return self.run_next();
        }
    }
};

Shell.prototype.TABDIALOG_MAX = 15;
Shell.prototype.tabdialog = function(entries) {
    var self = this,
        term = self.term,
        cli = self.cli,
        div = $('<div class="tabdialog"/>');

    if (entries.length > self.TABDIALOG_MAX) {
        var suffix = '(' + String(entries.length - self.TABDIALOG_MAX) + ' more...)';
        entries = entries.slice(0, self.TABDIALOG_MAX);
        entries.push(suffix);
    }

    for (var i = 0; i < entries.length; i++) {
        div.append($('<div class="tabdialog-entry">' + entries[i] + '</div>'));
    }
    if (self.td_div) {
        div.css('min-height', self.td_div.height());
        self.td_div.replaceWith(div);
    } else {
        cli.div.after(div);
    }
    self.td_div = div;
    div[0].scrollIntoView();
};

Shell.prototype.keydown = function(e) {
    var self = this,
        term = self.term,
        cli = self.cli;

    function rf() {
        self.tabstate = 0;
        return false;
    }

    //console.log('type: ' + e.type + ' which: ' + e.which);
    if (self.td_div && e.type === 'keydown' &&
        !(e.which >= 16 && e.which <= 20) && e.which != 91) {
        self.td_div.css('min-height', self.td_div.height());
        self.td_div.empty();
    }
    if (self.cli.cm_mode == 'multi') {
        return true;
    }
    if (e.which === 76 && e.ctrlKey) { /* ctrl-l */
        if (self.icmd_fg || self.icmd_bg.length) {
            return rf();
        }
        var cmd = cli.line(),
            pr = cli.options.prompt;
        cli.remove();
        term.clear();
        self.addcli();
        self.cli.line(cmd);
        self.cli.prompt(pr);
        return rf();
    }
    if (e.which === 67 && e.ctrlKey) { /* ctrl-c */
        if (self.icmd_fg) {
            setTimeout(function() {
                var fgterm = self.icmd_fg.context.term;
                self.icmd_fg.context.killed = '^C';
                for (var p in proc.proc) {
                    var pipe = proc.proc[p];
                    if (pipe.context.term === fgterm) {
                        pipe.ctl = 'kill';
                    }
                }
                self.icmd_fg = null;
                self.run_next.call(self);
            }, 0);
        }
        return rf();
    
    } else if (e.which === 90 && e.ctrlKey) { /* ctrl-z */
        if (self.icmd_fg) {
            setTimeout(function() {
                var fgterm = self.icmd_fg.context.term;
                for (var p in proc.proc) {
                    var pipe = proc.proc[p];
                    if (pipe.context.term === fgterm) {
                        if (pipe.status === 'start') {
                            pipe.ctl = 'stop';
                        }
                    }
                }
                self.icmd_fg = null;
                self.run_next.call(self);
            }, 0);
        }
        return rf();
    } else if (e.which === 66 && e.ctrlKey) { /* ctrl-b */
        if (self.icmd_fg) {
            setTimeout(function() {
                self.icmd_fg = null;
                self.run_next.call(self);
            }, 0);
        }
    }

    if (!e.charCode) {
        if (e.which === 38) { /* up arrow */
            var str = self.history.prev();
            if (str !== undefined) {
                if (self.history._halfdone === undefined) {
                    self.history._halfdone = cli.line();
                }
                cli.line(str);
            }
            return rf();
        }
        if (e.which === 40) { /* down arrow */
            var str = self.history.next();
            if (str !== undefined) {
                cli.line(str);
            } else if (self.history._halfdone !== undefined) {
                cli.line(self.history._halfdone);
                self.history._halfdone = undefined;
            }
            return rf();
        }
    }
    if (!(e.which == 9 && !(e.ctrlKey || e.altKey))) {
        self.tabstate = 0;
        return true;
    }
    if (self.tabstate) {
        /* We are currently processing a tab and don't want more */
        return false;
    }

    var pos = cli.position(),
        cmdline = cli.line(),
        cmdcomps = tokenize(cmdline.slice(0, pos)),
        last = cmdcomps.pop(),
        prev = (cmdcomps.length) ? cmdcomps[cmdcomps.length - 1] : '';

    var cmdsep = ['|', '||', '&&', ';', '$('];

    function command_match() {
        self.tabstate = 1;
        self.find_cmd_matches(last, function(err, res) {
            if (err || res.length === 0) {
                self.tabstate = 0;
            }
            /* User didn't wait for tab completion, pressed something else */
            if (self.tabstate === 0) {
                return;
            }
            var lcm = longest_common(res);
            cli.insert(lcm.slice(last.length));
            if (res.length > 1) {
                self.tabdialog(res);
            } else if (res.length === 1 && cmdline[pos - 1] !== ' ') {
                cli.insert(' ');
            }
            self.tabstate = 0;
            return;
        });
        return false;
    }

    function filename_match() {
        self.tabstate = 1;
        self.search(last + '*', {}, function(err, matches) {
            if (err || !matches.length) {
                self.tabstate = 0;
            }
            if (self.tabstate === 0) {
                return;
            }
            var lastcomp = last.split('/').pop(),
                names = matches.map(function(c) { return c[0];}),
                lcm = longest_common(names),
                ins = escape_file(lcm.slice(lastcomp.length));

            cli.insert(ins);
            if (matches.length > 1) {
                self.tabdialog(names);
            } else {
                if (matches.length == 1) {
                    if (isdir(matches[0][1])) {
                        cli.insert('/');
                    } else if (cmdline[pos - 1] !== ' ') {
                        cli.insert(' ');
                    }
                }
            }
            self.tabstate = 0;
        });
        return false;
    }
    
    if (cmdcomps.length === 0 || $.inArray(prev, cmdsep) != -1) {
        if (last.match('/')) {
            return filename_match();
        } else {
            return command_match();
        }
    } else {
        return filename_match();
    }
};

Shell.prototype.builtin_clear = function() {
    var self = this,
        cli = self.cli,
        term = self.term;

    if (self.interactive_shell) {
        cli.remove();
        term.clear();
        self.addcli();
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

    if (self.pipe !== undefined) {
        self.done = exitval;
        return self.eof();
    }
};

Shell.prototype.builtin_exit = function(exitval) {
    var self = this;

    if (self.docopts !== undefined && (self.docopts['-f'] || self.docopts['-s'])) {
        /* Merely a subshell of convenience, should affect parent */
        return self.shell.builtin_exit(exitval);
    }
    return self.byebye(exitval);
};

Shell.prototype.motd = function() {
    return 'pigshell v' + pigshell_version.str + '\n\n' +
'Resources on the web are represented as files in a hierarchical file system. These include public web pages as well as your data on Facebook, Google drive and Picasa albums. Construct pipelines of simple unix-style commands to filter, transform and display your files.\n\n' +
        '(type "help" for a list of commands, ' + 
        '"markdown /doc/README.md" for an introduction. ' +
        '/doc/pigshell.md is the user guide.)\n\n';
};

Shell.prototype.parse = function(str, srcfile) {
    var self = this,
        ast;

    try {
        ast = parser.parse(str);
    } catch (e) {
        return self.exit(parse_error(str, e));
    }
    //console.log(ast);
    return self.run(ast, srcfile);
};

Shell.prototype.run = function(ast, srcfile) {
    var self = this,
        args = self.docopts['<arg>'].slice(1),
        source = self.docopts['-s'],
        func = self.docopts['-f'];

    if (source) {
        /* source script to execute in same context */
        self.vars = self.shell.vars;
        self.ns = self.shell.ns;
        self.functions = self.shell.functions;
        self.argvars = self.shell.argvars;
    } else if (func) {
        /* function to execute in same context */
        self.vars = self.shell.vars;
        self.ns = self.shell.ns;
        self.functions = self.shell.functions;
    } else {
        self.ns = $.extend(true, {}, self.shell.ns);
        self.vars = $.extend(true, {}, self.shell.vars);
        self.functions = $.extend(true, {}, self.shell.functions);
        self.vars['?'] = ['true'];
    }

    if (!source) {
        if (srcfile) {
            args.unshift(srcfile);
        }
        for (var i = 0; i < args.length; i++) {
            self.argvars[i] = [args[i]];
        }
        self.argvars['*'] = args.slice(1);
        var nargs = (args.length > 1) ? args.length - 1: 0;
        self.argvars['#'] = [nargs.toString()];
    }

    var cerr = new ConnErr({}, self);
    self.cin = new ConnIn({}, self);
    self.cout = new ConnOut({}, self);
     
    var context = {stdin: self.cin, stdout: self.cout, stderr: cerr, term: self.pipe.context.term};
    try {
        self.ast_eval(ast, context, function(err, res) {
            if (self.docopts['-t']) {
                var now = Date.now();
                self.fds.stderr.data.fire('Elapsed: ' + (now - self.start_time) / 1000.0 + 's');
            }

            if (err) {
                return self.exit(err);
            } else {
                return self.byebye(res);
            }
        });
    } catch(e) {
        console.log('Exception: ' + e.message);
        console.log(e.stack);
        return self.exit(e.message);
    }
};

Shell.prototype.input_next = check_live(function(item) {
    var self = this;

    return self.cin.next(item);
});

Shell.prototype.fork_interactive = function(opts, termdiv) {
    var self = this,
        term = new Pterm({move: false}, termfs.root, termdiv.addClass('pterm-root')),
        argv = opts.argv || [],
        shell;
    shell = new Shell({ns: self.ns, argv: argv});
    shell.shell = self;
    shell.cwd = self.cwd;
    shell.interactive({histfile: "/tmp/history" + term.name, quiet: true}, term);
    return shell;
};

function History(opts, shell) {
    var self = this;

    self.shell = shell;
    self.hlist = [];
    self.hmax = self.HISTMAX;
    self.index = -1;
    self.HISTFILE = opts.histfile || self.DEFAULT_HISTFILE;
    fread.call(shell, self.HISTFILE, function(err, res) {
        if (err) {
            return;
        }
        self.hlist = res.split('\n').reverse();
    });
}

function longest_common(cmdlist) {
    var t1, t2, s, cmdlist = cmdlist.slice(0).sort();
    t1 = cmdlist[0];
    s = t1.length;
    t2 = cmdlist.pop();
    while (s && t2.indexOf(t1) !== 0) {
        t1 = t1.substring(0, --s);
    }
    return t1;
}

/*
 * Use lexer to return an array of strings corresponding to token values
 * (not token types). Used to lex command line for tab completion
 */

function tokenize_old(line) {
    var lexer = parser.lexer;
    lexer.setInput(line);
    var comps = [];
    // Parse upto 100 components. Finite loops good, infinite loops baad.
    for (var i = 0; i < 100; i++) {
        var token = lexer.lex(),
            yytext = lexer.yytext;
        if (token === parser.symbols_['EOF'] || token === lexer.EOF) {
            break;
        } else if (token == 'BARE_STRING') {
            yytext = yytext.replace(/\\(.)/g, "$1");
        }
        comps.push(yytext);
    }
    return comps;
}

function tokenize(line) {
    var comps = [];
    try {
        comps = parser.parse(line, {'startRule': 'TokenList'});
    } catch(e) {
    }
    return comps;
}

/*
 * XXX: Escaping, unescaping and command separators should really be DRY.
 * Right now they are spread all over and inconsistent to boot
 */

/*
 * Escape common special characters in filenames. Used for tab completion
 */

function escape_file(str) {
    return str.replace(/([\s\\;\(\)'<>"])/g, "\\$1");
}


function Pipeline(cmds, context, shell) {
    var self = this;
    if (cmds instanceof Array) {
        self.cmds = cmds;
    } else {
        self.cmds = [cmds];
    }
    self.shell = shell; // Shell
    self.context = context; // stdout, stderr

    self._status = 'init';
    self._exit_status = null;
    self.status_change = $.Callbacks();
    self.__defineGetter__('status', function() {
        return self._status;
    });
    self.__defineGetter__('exit', function() {
        return self._exit_status;
    });
    self.__defineSetter__('ctl', function(val) {
        return self.do_ctl(val);
    });
    self._jfs = ['exit', 'status', 'ctl', 'cmdline'];
    self.pid = proc.newpid();

    var cmdlines = $.map(self.cmds, function(cmd) { return cmd ? cmd.opts.argv.join(' ') : ''; });
    self.cmdline = cmdlines.reverse().join('|');
    proc.add(self.pid, self);
    shell.vars['!'] = [self.pid.toString()];

    if (context.notify !== undefined) {
        self.status_change.add(function(status) {
            var st = {'status': status};
            if (status === 'done') {
                st.exit_status = self._exit_status;
            }
            context.notify.fds.stdin.data.fire(st);
        });
    }
}

Pipeline.prototype.do_ctl = function(val) {
    var self = this,
        op = val.split(/\s/)[0];

    if (op === 'stop' && self._status === 'start') {
        self._status = 'stop';
        self.status_change.fire('stop');
    } else if (op === 'start' && (self._status === 'init' || self._status === 'stop')) {
        self._status = 'start';
        self.status_change.fire('start');
    } else if (op === 'kill' && self._status !== 'done') {
        self._status = 'done';
        self.kill();
        self.status_change.fire('done');
    }
};

Pipeline.prototype.run = function(cb) {
    var self = this;

    try {
        self._run(cb);
    } catch(e) {
        console.log(e.stack);
        self.context.stderr.fds.stdin.data.fire('Exception: ' + e.message);  
        self.kill();
    }
};

Pipeline.prototype._run = function(cb) {
    var self = this,
        cmd, first, last,
        stdout = self.context.stdout,
        stderr = self.context.stderr,
        stdin = self.context.stdin;

    self.cmds.unshift(stdout);
    self.cmds.push(stdin);
    for (var i = 0, j = self.cmds.length - 1; i < j; i++) {
        cmd = self.cmds[i];
        self.cmds[i + 1].fds.stdout.data.add(function(cmd) {
            return function(arg) {
                cmd.fds.stdin.data.fire(arg);
            };
        }(cmd));
        self.cmds[i + 1].fds.stderr.data.add(function(arg) {
            stderr.fds.stdin.data.fire(arg);
        });
        cmd.fds.stdin.signal.add((function(i) { return function() {
            self.cmds[i + 1].fds.stdout.signal.fire();
        };})(i));
        if (i !== 0) {
            cmd.downstream = self.cmds[i - 1];
        }
        cmd.upstream = self.cmds[i + 1];
        cmd.shell = self.shell;
        cmd.cwd = self.shell.cwd;
        cmd.pipe = self;
    }

    // First command in pipeline (stdin)
    first = self.cmds[j];
    first.upstream = null;
    first.downstream = self.cmds[j - 1];
    first.shell = self.shell;
    first.cwd = self.shell.cwd;
    first.pipe = self;

    last = self.cmds[0];
    last.fds.stdout.data.add(function(res) {
        /*
         * The last command never outputs anything except a final null
         * indicating end of pipeline, so we do pipeline exit processing
         * here
         */
        stderr.fds.stdin.data.fire(res);
        self._status = 'done';
        self._exit_status = last.upstream.done;
        self.status_change.fire('done');
        last.reset();
        first.reset();
        proc.rm(self.pid);
        self.shell.vars['?'] = [self._exit_status.toString()];
        return cb(null, self._exit_status);
    });
    last.fds.stderr.data.add(function(arg) {
        stderr.fds.stdin.data.fire(arg);
    });

    stderr.shell = self.shell;
    stderr.cwd = self.shell.cwd;
    stderr.pipe = self;

    self.ctl = 'start';
    last.fds.stdout.signal.fire();
};

Pipeline.prototype.kill = function() {
    var self = this;
    for (var i = self.cmds.length - 1; i >= 0; i--) { 
        self.cmds[i].kill('killed');
    }
};

function Command() {
    this.upstream = null;
    this.downstream = null;
    this.fds = {
        'stdin': {'data': $.Callbacks(), 'signal': $.Callbacks()},
        'stdout': {'data': $.Callbacks(), 'signal': $.Callbacks()},
        'stderr': {'data': $.Callbacks()},
        'notify': {'data': $.Callbacks()}
    };
    this.state_func = null;
    this._buffer = [];
    this._linebuffer = '';
    this.done = undefined; // If we're done, operations are aborted
    this._status = {};
    this.log = [];
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

/* XXX: needs more thought, reimp around notify callback */
Command.prototype.status = function(arg) {
    var self = this;

    if (arg === undefined) {
        return self._status;
    } else if (typeof arg == 'string') {
        self._status['status'] = arg;
        if (self.DEBUG) {
            self.log.push('Status: ' + arg);
        }
    } else if (typeof arg == 'object') {
        for (var a in arg) {
            self._status[a] = arg[a];
            if (self.DEBUG) {
                self.log.push(a.charAt(0).toUpperCase() + a.slice(1) + ': ' + arg[a]);
            }
        }
    } else {
        throw 'Status must be a string or object';
    }
};

Command.prototype.kill = function(reason) {
    this.done = reason;
    this._abortable.forEach(function(xhr) {
        xhr.abort();
    });
    this._abortable = [];
};

Command.prototype.lookup = function(path, opts, cb) {
    var opts2 = $.extend({}, opts, {context: this});
    return this.shell.ns.lookup(path, opts2, wrap_cb(this, cb));
};

Command.prototype.search = function(path, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return self.shell.ns.search(path, opts2, wrap_cb(self, cb));
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
    var self = this;

    return self.shell.ns.chdir(path, {context: self},
        wrap_cb(self, ef(cb, function(res) {
        self.cwd = res;
        return cb(null, res.cwd);
    })));
};

Command.prototype.read = function(file, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return file.read(opts2, wrap_cb(self, cb));
};

Command.prototype.bundle = function(file, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return file.bundle(opts2, wrap_cb(self, cb));
};

Command.prototype.putdir = function(file, name, list, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return file.putdir(name, list, opts2, wrap_cb(self, cb));
};

Command.prototype.unbundle = function(file, name, data, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return file.unbundle(name, data, opts2, wrap_cb(self, cb));
};

Command.prototype.append = function(file, data, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return file.append(data, opts2, wrap_cb(self, cb));
};

Command.prototype.stat = function(file, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return file.stat(opts2, wrap_cb(self, cb));
};

Command.prototype.link = function(destdir, srcfile, name, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return destdir.link(srcfile, name, opts2, wrap_cb(self, cb));
};

Command.prototype.readdir = function(dir, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return dir.readdir(opts2, wrap_cb(self, cb));
};

Command.prototype.rm = function(dir, name, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return dir.rm(name, opts2, wrap_cb(self, cb));
};

Command.prototype.mkdir = function(dir, name, opts, cb) {
    var self = this,
        opts2 = $.extend({}, opts, {context: self});

    return dir.mkdir(name, opts2, wrap_cb(self, cb));
};

/* Signal upstream that you want more data to process */
Command.prototype.more = check_soguard(function() {
    if (this._buffer.length) {
        /* Consume item from buffer */
        return this.item_handler(this._buffer.shift());
    } else {
        return this.fds.stdin.signal.fire();
    }
});

/* Set handler for 'more' signal from downstream */
Command.prototype.more_handler = function(f) {
    this.fds.stdout.signal.add(f);
};

/* Set input handler */
Command.prototype.input_handler = function(f) {
    var self = this;
    self.item_handler = f;
    self.fds.stdin.data.add(function(res) {
        if (res instanceof Array) {
            self._buffer = self._buffer.concat(res);
        } else {
            self._buffer.push(res);
        }
        return self.item_handler(self._buffer.shift());
    });
};

/*
 * Like input handler, but also splits strings into lines, passes non-strings
 * as-is.
 */
Command.prototype.line_input_handler = function(f) {
    var self = this;
    self.item_handler = f;

    function makelines(str) {
        var lines = (self._linebuffer + str).split('\n'),
            last = lines.pop(),
        lines = lines.map(function(m) { return m + '\n'; });
        self._linebuffer = last;
        self._buffer = self._buffer.concat(lines);
    }

    self.fds.stdin.data.add(function(res) {
        if (!(res instanceof Array)) {
            res = [res];
        }
        async.forEachSeries(res, function(item, acb) {
            if (isstring(item)) {
                makelines(item);
            } else if (item instanceof Blob) {
                to('text', item, {}, function(err, res) {
                    if (err) {
                        return self.exit(err);
                    }
                    makelines(res);
                    return soguard(self, acb.bind(null, null));
                });
                return;
            } else {
                if (self._linebuffer) {
                    self._buffer.push(self._linebuffer);
                    self._linebuffer = '';
                }
                self._buffer.push(item);
            }
            return soguard(self, acb.bind(null, null));
        },
        function(err) {
            /*
             * If buffer contains items, will run it through item_handler,
             * else will call upstream command
             */
            return self.more();
        });
    });
};

/* Emit output to stdout */
Command.prototype.output = function(res) {
    this.fds.stdout.data.fire(res);
};

/* Emit output to stderr */
Command.prototype.errmsg = function(err, str) {
    this.fds.stderr.data.fire(err_stringify(err, str, this.usage) + '\n');
};

/* Send EOF to downstream */
Command.prototype.eof = function() {
    this.fds.stdout.data.fire(null);
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
        return this.eof();
    }
};

/* Get my terminal. Equivalent to asking for /dev/tty. */
Command.prototype.pterm = function() {
    return this.pipe.context.term;
};

/*
 * Is our input or output a tty? Some commands may change their behaviour
 * depending whether stdin/stdout is a tty. e.g. ls.
 */
Command.prototype.isatty = function(fd) {
    var conn = (fd === Stdout) ? ConnOut : ConnIn,
        stream = (fd === Stdout) ? this.downstream : this.upstream;

    if (stream instanceof fd) {
            return true;
    }
    return (stream instanceof conn) ? this.shell.isatty(fd) : false;
};

function OCommand() {
    OCommand.base.call(this);
}

inherit(OCommand, Command);

OCommand.prototype.kill = function(reason) {
    this.done = reason;
    return this.eof();
};

OCommand.prototype.exit = function(e) {
    this.done = (e !== undefined && e !== null) ? e : true;
    if (e) {
        this.errmsg.apply(this, arguments);
    }
    if (this.done !== true) {
        return this.pipe.kill();
    } else {
        return this.eof();
    }
};

function sh_check_live(f) {
    return function() {
        var self = this,
            args = [].slice.call(arguments),
            callback = args[args.length - 1];
        function cl() {
            if (self.done !== undefined) {
                return callback(self.done);
            }
            return f.apply(self, args);
        }

        if (self.pipe === undefined) {
            return cl();
        }
        if (self.pipe.status === 'start') {
            return cl();
        }
        var cb = function() {
            if (self.pipe.status === 'start') {
                self.pipe.status_change.remove(cb);
                return cl();
            }
        };
        self.pipe.status_change.add(cb);
    };
}

/*
 * Commands which process either a list of files supplied in the arguments
 * or stdin should use this decorator.
 */

function fileargs(more) {
    return function() {
        var self = this,
            filenames = self.docopts['<file>'];
        if (filenames && filenames.length) {
            self.docopts['<file>'] = null;
            lookup_files.call(self, {}, filenames, function(entries) {
                var files = $.map(entries, function(e) { return e.file; });
                files.push(null);
                self._buffer = self._buffer.concat(files);
                return more.apply(self, arguments);
            });
        } else {
            return more.apply(self, arguments);
        }
    };
}

/*
 * Lookup a list of pathnames, supply cb with the list of entry objects
 * An entry object looks like {path: pathname, file: fileobject} 
 */

function lookup_files(opts, plist, cb) {
    var self = this,
        entries = [];
    async.forEachSeries(plist, function(p, acb) {
        if (p instanceof File) {
            entries.push({path: p.name, file:p});
            return soguard(self, acb.bind(this, null));
        }
        if (!opts.query) {
            self.lookup(p, {}, function(err, f) {
                if (err) {
                    self.errmsg(err, p);
                    return soguard(self, acb.bind(this, null));
                }
                entries.push({path: p, file: f});
                return soguard(self, acb.bind(this, null));
            });
        } else {
            self.search(p, {query: true}, function(err, f) {
                if (err) {
                    self.errmsg(err, p);
                    return soguard(self, acb.bind(this, null));
                }
                var comps = pathsplit(p),
                    last = comps[1],
                    pdir = comps[0];

                for (var i = 0; i < f.length; i++) {
                    entries.push({path: pathjoin(pdir, f[i][0]), file: f[i][1]});
                }
                return soguard(self, acb.bind(this, null));
            });
        }

    }, function(err) {
           return cb(entries);
    });
}

function Stdout(opts, term) {
    var self = this;
    self.opts = opts;
    self.term = term;
    self.reset();
}

inherit(Stdout, OCommand);

Stdout.prototype.reset = function() {
    var self = this;

    Stdout.base.call(self);
    self.input_handler(self.next.bind(self));
    self.more_handler(self.more.bind(self));
};

Stdout.prototype.next = function(res) {
    var self = this;

    if (res !== null) {
        self.term.append(res);
        self.more();
    } else {
        self.eof();
    }
};

function Stdin(opts, term) {
    var self = this;
    self.opts = opts;
    self.term = term;
    self.reset();
}

inherit(Stdin, Command);

Stdin.prototype.reset = function() {
    var self = this;

    Stdin.base.call(self);
    self.more_handler(self.more_next.bind(self));
};

Stdin.prototype.more_next = check_live(function() {
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
        proc.proc[self.pipe.pid].ctl = 'kill';
        return false;
    }
    if (e.which === 90 && e.ctrlKey) { /* ctrl-z */
        proc.proc[self.pipe.pid].ctl = 'stop';
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

function Stderr(opts, term) {
    var self = this;

    Stderr.base.call(self);
    self.opts = opts;
    self.term = term;
    self.input_handler(self.next.bind(self));
}

inherit(Stderr, Command);

Stderr.prototype.next = function(res) {
    var self = this;
    if (res !== null) {
        self.term.append(res.toString());
    } else {
        //self.term.append('null message to stderr');
    }
};

function Pnotify(opts, cli) {
    var self = this;

    Pnotify.base.call(self);
    self.opts = opts;
    self.cli = cli;
    self.input_handler(self.next.bind(self));
}

inherit(Pnotify, Command);

Pnotify.prototype.next = function(res) {
    var self = this;
    if (res !== null) {
        //console.log(res);
        if (res.status !== undefined) {
            if (res.status === 'start') {
                self.cli.prompt(null, 'green');
            } else if (res.status === 'stop') {
                self.cli.prompt(null, 'amber');
            } else if (res.status === 'done') {
                if (res.exit_status === true) {
                    self.cli.prompt(null, 'prompt');
                } else {
                    self.cli.prompt(null, 'red');
                }
            }
        }
    } else {
        console.log('null message to notify');
    }
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

    self.opts = opts;
    self.sink = [];
    self.reset();
}

inherit(Stdsink, OCommand);

Stdsink.prototype.reset = function() {
    var self = this;

    Stdsink.base.call(self);
    self.input_handler(self.next.bind(self));
    self.more_handler(self.more.bind(self));
};

Stdsink.prototype.next = function(res) {
    var self = this;

    if (res === null) {
        return self.eof();
    } else if (isstring(res)) {
        res = res.trim();
        if (res !== '') {
            self.sink.push(res);
        }
    } else {
        self.sink.push(res);
    }
    self.more();
};

function RedirIn(opts, target) {
    var self = this;

    self.opts = opts;
    self.target = target;
    self.reset();
}

inherit(RedirIn, OCommand);

RedirIn.prototype.reset = function() {
    var self = this;

    RedirIn.base.call(self);
    self.more_handler(self.more_next.bind(self));
};

RedirIn.prototype.more_next = check_live(function() {
    var self = this;

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

    self.opts = opts;
    self.target = target;
    self.targetdir = null;
    self.sink = [];
    self.reset();
}

inherit(RedirOut, OCommand);

RedirOut.prototype.reset = function() {
    var self = this;

    RedirOut.base.call(self);
    self.more_handler(self.more_next.bind(self));
    self.input_handler(self.next.bind(self));
};

RedirOut.prototype.more_next = check_live(function() {
    var self = this;

    if (self.targetdir === null) {
        var comps = pathsplit(self.target),
            last = comps[1],
            parentdir = comps[0];
        
        self.lookup(parentdir, {}, function(err, res) {
            if (err) {
                return self.exit(err, parentdir);
            }
            if (res.putdir) {
                self.targetdir = res;
                self.targetfilename = last; 
                return self.more();
            } else {
                return self.exit(E('ENOSYS'), parentdir);
            }
        });
    } else {
        return self.more();
    }
});

RedirOut.prototype.next = check_live(function(obj) {
    var self = this;
    if (obj !== null) {
        self.sink.push(obj);
        self.more();
    } else {
        self.putdir(self.targetdir, self.targetfilename, self.sink, {},
            function(err, res) {
            return self.exit(err, self.targetfilename);
        });
    }
});

function RedirAppend(opts, target) {
    var self = this;

    self.opts = opts;
    self.target = target;
    self.targetfile = null;
    self.reset();
}

inherit(RedirAppend, OCommand);

RedirAppend.prototype.reset = function() {
    var self = this;

    RedirAppend.base.call(self);
    self.more_handler(self.more_next.bind(self));
    self.input_handler(self.next.bind(self));
};

RedirAppend.prototype.more_next = check_live(function() {
    var self = this;

    if (self.targetfile !== null) {
        return self.more();
    } else {
        self._init(function(err, res) {
            if (err) {
                return self.exit(err, res);
            }
            return self.more();
        });
    }
});

RedirAppend.prototype._init = function(cb) {
    var self = this,
        comps = pathsplit(self.target),
        last = comps[1],
        ppath = comps[0];

    function set_afile(file) {
        if (file.append) {
            self.targetfile = fstack_base(file);
            return cb(null);
        } else {
            return cb(E('ENOSYS'), file);
        }
    }

    self.lookup(ppath, {}, function(err, parentdir) {
        if (err) {
            return cb(err, ppath);
        }
        self.parentdir = fstack_base(parentdir);
        self.lookup(self.target, {}, function(err, res) {
            if (err || self.opts.overwrite) {
                if (err && err.code !== 'ENOENT') {
                    return cb(err, self.target);
                }
                self.putdir(parentdir, last, [''], {}, function(err, res) {
                    if (err) {
                        return cb(err, self.target);
                    }
                    self.lookup(self.target, {}, function(err, res) {
                        if (err) {
                            return cb(err, self.target);
                        }
                        return set_afile(res);
                    });
                });
            } else {
                return set_afile(res);
            }
        });
    });
};

RedirAppend.prototype.next = check_live(function(obj) {
    var self = this;

    if (self.targetfile !== null) {
        return do_next();
    } else {
        self._init(function(err, res) {
            if (err) {
                return self.exit(err, res);
            }
            return do_next();
        });
    }

    function do_next() {
        if (obj === null) {
            return self.exit();
        } else {
            self.append(fstack_top(self.targetfile), obj, {}, function(err, res) {
                if (err) {
                    return self.exit(err, self.target);
                }
                fstack_invaldir(fstack_top(self.parentdir)); // Hack to update file size in ls
                if (!self.opts.stderr) {
                    return self.more();
                }
            });
        }
    }
});

function ConnOut(opts, cmd) {
    var self = this;
    self.opts = opts;
    self.cmd = cmd;
    self.reset();
}

inherit(ConnOut, OCommand);

ConnOut.prototype.reset = function() {
    var self = this;

    ConnOut.base.call(self);
    self.input_handler(self.next.bind(self));
    self.more_handler(self.more.bind(self));
};

ConnOut.prototype.next = function(res) {
    var self = this;

    /*
     * Subtle! If we get null, we output null on our own account, to trigger
     * end-of-pipeline processing. If not, we output the result on the 'sh'
     * command's behalf.
     */

    if (res === null) {
        return self.eof();
    } else {
        return self.cmd.output.call(self.cmd, res);
    }
};

function ConnIn(opts, cmd) {
    var self = this;
    self.opts = opts;
    self.cmd = cmd;
    self.reset();
}

inherit(ConnIn, Command);

ConnIn.prototype.reset = function() {
    var self = this;

    ConnIn.base.call(self);
    self.more_handler(self.cmd.more.bind(self.cmd));
};

ConnIn.prototype.next = function(res) {
    var self = this;

    return self.output(res);
};

function ConnErr(opts, cmd) {
    var self = this;

    ConnErr.base.call(self);
    self.opts = opts;
    self.cmd = cmd;
    self.input_handler(function(res) {
        return self.cmd.fds.stderr.data.fire(res);
    });
}

inherit(ConnErr, Command);

History.prototype.DEFAULT_HISTFILE = "/local/history";
History.prototype.HISTMAX = 100;

History.prototype.add = function(str) {
    var self = this,
        hlist = self.hlist;

    self.index = -1;
    str = $.trim(str);
    if (str === '' || str === hlist[0]) {
        return;
    }
    hlist.unshift(str);
    if (hlist.length > self.hmax) {
        hlist = hlist.slice(0, self.hmax);
    }
    self.hlist = hlist;
    self.save();
};

History.prototype.save = function() {
    var self = this,
        data = self.hlist.slice(0).reverse().join('\n');
    
    fwrite.call(self.shell, self.HISTFILE, [data], function() {});
};

History.prototype.prev = function() {
    var self = this,
        last = self.hlist.length - 1,
        str;

    if (self.index <= last) {
        self.index++;
    }
    if (self.index <= last) {
        str = self.hlist[self.index];
    }
    return str;
};

History.prototype.next = function() {
    var self = this,
        str;

    if (self.index >= 0 ) {
        self.index--;
    }
    if (self.index >= 0) {
        str = self.hlist[self.index];
    }
    return str;
};

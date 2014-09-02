/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * Interactive shell
 */

function IShell(opts) {
    var self = this;

    IShell.base.call(self, opts);
    self.tabstate = 0;
}

inherit(IShell, Command);

IShell.prototype.usage = 'ish          -- interactive shell\n\n' +
    'Usage:\n' +
    '    ish [-N <name>] [-h | --help]\n\n' +
    'Options:\n' +
    '    -N <name>    Name of this instance, used to send messages\n' +
    '    -h --help    Show this message.\n';

IShell.prototype.next = check_next(do_docopt(function(opts, cb) {
    var self = this;

    if (!opts.term) {
        return self.exit("ish must be run with a term");
    }
    self.term = opts.term;
    self.addcli();
    self.history = new History(opts, self);
    self.icmd_fg = null;
    self.icmd_bg = [];
    $(self.term.div).resize(function() {
        rescroll(self.term.div);
    });
    self.run_next();
    if (self.docopts['-N']) {
        subscribe(self.docopts['-N'], function(str) {
            if (!isstring(str)) {
                console.log("Unknown input to ish: ", str);
            }
            if (self.cli) {
                var lines = str.split('\n');
                lines.forEach(function(l) {
                    self.cli.cli_input(l);
                });
            }
        });
    }
}));

IShell.prototype.addcli = function() {
    var self = this;

    var clidiv = $('<div/>');
    self.term.div.append(clidiv);
    self.cli = new Readline({prompt: '>', keydown: self.keydown.bind(self), input: self.cli_input.bind(self)}, clidiv);
};

IShell.prototype.cli_input = function(cmd) {
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

IShell.prototype.run_next = function() {
    var self = this,
        pwd = self.shell.cwd.comps[self.shell.cwd.comps.length - 1].name;

    if (self.icmd_fg) {
        return;
    }
    
    var icmd = self.icmd_bg.shift();
    if (!icmd) {
        self.cli.prompt('pig:' + pwd + '$ ');
        return;
    }

    var term = icmd.term,
        cmd = icmd.cmd.trim(),
        cli = icmd.cli,
        ast;

    cli.prompt('pig:' + pwd + '$ ');
    if (cmd === "") {
        return self.run_next();
    }
    var shell = new Shell({argv: ['sh', '-sc', cmd], shell: self.shell}),
        ctext = {
            stdout: new Stdout({}, term),
            stdin: new Stdin({}, term),
            stderr: term
        },
        p = makepipe(shell, ctext);

    
    icmd.pid = shell.pid;
    self.icmd_fg = icmd;

    /*
     * Yuck. Will have to do until we get either proper parent linkages or
     * generic means of naming and message passing across commands.
     */
    shell.builtin_clear = self.builtin_clear.bind(self);

    //try {
        shell._status_change.add(function(res) {
            if (shell.status !== undefined) {
                if (shell.status === 'start') {
                    cli.prompt(null, 'green');
                } else if (shell.status === 'stop') {
                    cli.prompt(null, 'amber');
                } else if (shell.status === 'done') {
                    if (shell.vars['?'] && shell.vars['?'][0] === 'true') {
                        cli.prompt(null, 'prompt');
                    } else {
                        cli.prompt(null, 'red');
                    }
                }
            }
        });
        cli.prompt(null, 'green');
        proc.current(null);
        p.next({term: self.term}, function(err, res) {
            proc.current(self);
            if (err) {
                console.log(err);
            }
            if (self.icmd_fg === icmd) {
                self.icmd_fg = null;
                return self.run_next();
            }
        });
    //} catch (e) {
    //    term.append('Exception: ' + e.message);
    //    console.log(e.stack);
    //    if (self.icmd_fg === icmd) {
    //        self.icmd_fg = null;
    //        return self.run_next();
    //    }
    //}
};

IShell.prototype.TABDIALOG_MAX = 15;
IShell.prototype.tabdialog = function(entries) {
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

function tokenize(line) {
    var comps = [];
    try {
        comps = parser.parse(line, {'startRule': 'TokenList'});
    } catch(e) {
    }
    return comps;
}

IShell.prototype.histsearch = function(e) {
    var self = this,
        term = self.term,
        cli = self.cli,
        hist = self.history;

    function rf() {
        self.searchstate = 0;
        cli.prompt(self._oldprompt);
        return false;
    }

    if (e.which === 13) { /* enter */
        self.searchstate = 0;
        cli.prompt(self._oldprompt);
        return;
    }

    if (e.which === 9 || e.which === 27) { /*  tab, backspace */
        return rf();
    }
    if (!e.charCode) {
        if (e.which >= 37 && e.which <= 40) { /* arrow keys */
            return rf();
        }
    }
    var curstr = self._searchstr;
    if (e.which === 8) { /* backspace */
        curstr = self._searchstr.slice(0, self._searchstr.length - 1);
        self._searchpos = -1;
    } else {
        if (e.which === 82 && e.ctrlKey) { /* ctrl-r */
            /* fall through, search for next occurence in history */
        } else if (e.type !== 'keypress') {
            return;
        } else if (e.ctrlKey || e.altKey) {
            return rf();
        } else {
            curstr = self._searchstr + String.fromCharCode(e.which);
            self._searchpos = -1;
        }
    }
    var hs = hist.search(curstr, self._searchpos);
    if (hs === null) {
        return false;
    }
    self._searchstr = curstr;
    self._searchpos = hs[0];
    cli.prompt("(search)'" + self._searchstr + "': ");
    cli.line(hs[1]);
    cli.position(hs[1].indexOf(curstr));
    return false;
};

IShell.prototype.keydown = function(e) {
    var self = this,
        term = self.term,
        cli = self.cli;

    function rf() {
        self.tabstate = 0;
        return false;
    }

    if (self.searchstate) {
        return self.histsearch(e);
    }
    //console.log('type: ' + e.type + ' which: ' + e.which);
    if (self.td_div && e.type === 'keydown' &&
        !(e.which >= 16 && e.which <= 20) && e.which != 91) {
        /* Not shift, ctrl, alt, pause, caps, windows */
        self.td_div.css('min-height', self.td_div.height());
        self.td_div.empty();
    }
    if (self.cli.cm_mode == 'multi') {
        return true;
    }
    if (e.which === 82 && e.ctrlKey) { /* ctrl-r */
        self.searchstate = 1;
        self._searchstr = '';
        self._searchpos = -1;
        self._oldprompt = cli.options.prompt;
        cli.prompt("(search)'': ");
        return false;
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
                var pid = self.icmd_fg.pid;
                proc.proc[pid].ctl = 'kill';
            }, 0);
        }
        return rf();
    
    } else if (e.which === 90 && e.ctrlKey) { /* ctrl-z */
        if (self.icmd_fg) {
            setTimeout(function() {
                var pid = self.icmd_fg.pid,
                    sh = proc.proc[pid];
                if (sh && sh.status === 'start') {
                    sh.ctl = 'stop';
                }
                self.icmd_fg = null;
                self.run_next(self);
            }, 0);
        }
        return rf();
    } else if (e.which === 66 && e.ctrlKey) { /* ctrl-b */
        if (self.icmd_fg) {
            setTimeout(function() {
                self.icmd_fg = null;
                self.run_next();
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
        /* Any key which is not a tab */
        self.tabstate = 0;
        return true;
    }

    /* We got a tab */

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
        sys.search(self.shell, last + '*', {}, function(err, matches) {
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
        if (last && last.match('/')) {
            return filename_match();
        } else {
            return command_match();
        }
    } else {
        return filename_match();
    }
};

IShell.prototype.builtin_clear = function() {
    var self = this,
        cli = self.cli,
        term = self.term;

    cli.remove();
    term.clear();
    self.addcli();
};

/* Used by tab completion */
IShell.prototype.find_cmd_matches = function(cmd, cb) {
    var self = this,
        re = new RegExp('^' + cmd),
        matches = [];

    matches = Object.keys(self.shell.functions).filter(function(c) { return re.test(c);});
    matches = matches.concat(Command.list().filter(function(c) { return re.test(c);}));

    sys.search(self.shell, '/bin/' + cmd + '*', {}, function(err, res) {
        if (!err) {
            res = res.map(function(c) { return c[0];});
            matches = matches.concat(res);
        }
        sys.search(self.shell, '/local/' + cmd + '*', {}, function(err, res) {
            if (!err) {
                res = res.map(function(c) { return c[0];});
                matches = matches.concat(res);
            }
            return cb(null, uniq(matches));
        });
    });
};

Command.register("ish", IShell);

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

History.prototype.search = function(str, frompos) {
    var self = this;

    if (frompos === undefined) {
        frompos = -1;
    }
    for (var i = frompos + 1, max = self.hlist.length; i < max; i++) {
        var m = self.hlist[i].indexOf(str);
        if (m !== -1) {
            self.index = i;
            return [i, self.hlist[i]];
        }
    }
    return null;
};

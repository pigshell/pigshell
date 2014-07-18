/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

function Ls(opts) {
    var self = this;

    Ls.base.call(self, opts);
    self.entries = [];
    self.current = -1;
    self.state_func = null;
    self.arglist = [];
    self.maxdepth = 1;
    self.curdepth = 0;
    self.visited = {};
}

inherit(Ls, Command);

Ls.prototype.usage = 'ls           -- list directory contents\n\n' +
    'Usage:\n' +
    '    ls [-h | --help]\n' +
    '    ls [-aldRqrtcTGFDX] [-f <field>] [-s <date>] [-m <num>] [-n <depth>] [<file>...]\n\n' +
    'Options:\n' +
    '    -h --help    Show this message.\n' +
    '    -a           Show hidden files\n' +
    '    -l           Long listing\n' +
    '    -d           Directories are listed as plain files\n' +
    '    -R           Recursively descend directories\n' +
    '    -n <depth>   Recursively descend directories upto n levels\n' +
    '    -q           Query sparse directories for files matching given keyword\n' + 
    '    -r           Reverse order of sorting\n' +
    '    -t           Use time of last modification for sorting\n' +
    '    -c           Use time of creation for sorting\n' +
    '    -T           Force text display, even if file has HTML representation\n' +
    '    -G           Output pathnames, similar to find .\n' +
    '    -D           Descend any file which implements readdir(), e.g. HTML\n'+
    '    -X           Cross filesystems during recursive descent\n'+
    '    -F           Force reload of all files in directory\n' +
    '    -f <field>   Use specified field for sorting\n' +
    '    -s <date>    Start timestamp, used when listing large "feed" directories\n' +
    '    -m <num>     Maximum number of items per directory, used when listing large "feed" directories\n';

Ls.prototype.next = check_next(do_docopt(function(opts, cb) {
    var self = this;

    function feed_sort(a, b) {
        return (b.file.mtime < a.file.mtime) ? -1 : ((b.file.mtime > a.file.mtime) ? 1 : 0);
    }

    function init() {
        self.is_tty = isatty(opts.term);
        self.retval = true;
        if (self.docopts['-t']) {
            self.sort_func = function(a, b) {
                return (a.file.mtime < b.file.mtime) ? -1 : ((a.file.mtime > b.file.mtime) ? 1 : 0);
            };
        } else if (self.docopts['-c']) {
            self.sort_func = function(a, b) {
                return (a.file.ctime < b.file.ctime) ? -1 : ((a.file.ctime > b.file.ctime) ? 1 : 0);
            };
        } else if (self.docopts['-f']) {
            var sort_field = self.docopts['-f'];
            self.sort_func = function(a, b) {
                return (a.file[sort_field] < b.file[sort_field]) ? -1 : ((a.file[sort_field] > b.file[sort_field]) ? 1 : 0);
            };
        } else {
            self.sort_func = function(a, b) {
                var bname = basename(b.path),
                    aname = basename(a.path);
                return (aname < bname) ? -1 : ((aname > bname) ? 1 : 0);
            };
        }

        if (self.docopts['-d']) {
            self.maxdepth = 0;
        } else if (self.docopts['-q']) {
            self.query = true;
            self.maxdepth = 0;
        } else if (self.docopts['-R']) {
            self.maxdepth = 12;
        }
        if (self.docopts['-n']) {
            self.maxdepth = parseInt(self.docopts['-n'], 10);
            if (isNaN(self.maxdepth) || self.maxdepth < 0) {
                return self.exit('Argument to -n must be a number >= 0');
            }
        }

        var since = self.docopts['-s'];
        if (since) {
            if (isnumber(since)) {
                since = parseFloat(since);
            }
            self.since = moment(since).valueOf();
        }
        if (self.docopts['-m']) {
            self.maxentries = parseInt(self.docopts['-m'], 10);
            if (isNaN(self.maxentries)) {
                return self.exit('Argument to -m must be a number');
            }
        }
        if (self.docopts['-F']) {
            self.reload = true;
        }

        if (self.docopts['<file>'].length === 0) {
            self.docopts['<file>'] = ['.'];
        }
        self.state_func = process_args;
        return self.state_func();
    }

    function process_args() {
        lookup_files.call(self, {query: self.query},  self.docopts['<file>'], function(flist) {
            self.entries.push({depth: 0});
            queue_add(flist);
            self.state_func = main;
            return self.state_func();
        });
    }

    function visited(ident) {
        var len = ident.length;
        return self.visited[ident] || (ident[len - 1] === '/' &&
            self.visited[ident.slice(0, len - 1)]);
    }

    function main() {
        var entry, op;

        while ((entry = self.entries.shift())) {
            if (entry.spacer) {
                var op = format(entry);
                if (op) {
                    return self.output(op);
                }
            } else if (entry.depth !== undefined) {
                self.curdepth = entry.depth;
            } else if (!entry.file._hidden || self.docopts['-a']) {
                break;
            }
        }

        if (entry) {
            if (isdir(entry.file) && !entry.nodescend &&
                !visited(entry.file.ident) && self.curdepth < self.maxdepth &&
                (self.docopts['-D'] || self.curdepth === 0 ||
                !entry.file._nodescend)) {
                var isfeed = entry.file.feed,
                    isurl = URI.parse(entry.path).isAbsolute();
                self.visited[entry.file.ident] = true; /* Avoid cycles */
                sys.readdir(self, entry.file, {}, function(err, files) {
                    if (err) {
                        self.retval = false;
                        self.errmsg(err, entry.path);
                        return self.output(format(entry));
                    }
                    var paths = Object.keys(files).map(function(i) {
                        return isurl ? files[i].ident :
                            pathjoin(entry.path, i);
                        });
                    if (isurl) {
                        paths = paths.filter(function(e, i, s) {
                            return s.indexOf(e) === i;
                        });
                    }
                    self.entries.push({depth: self.curdepth + 1});
                    var diruri = URI.parse(entry.file.ident);
                    lookup_files.call(self, {search: self.query}, paths, function(flist) {
                        /*
                         * Avoid crossing filesystems while recursing 
                         */
                        if (!self.docopts['-X']) {
                            flist.forEach(function(e) {
                                var euri = URI.parse(e.file.ident);
                                if (diruri.authority() !== euri.authority()) {
                                    e.nodescend = true;
                                }
                            });
                        }
                        if (self.docopts['<file>'].length === 1 && self.curdepth === 0) {
                            queue_add(flist, isfeed);
                            return self.state_func();
                        } else {
                            self.entries.push({spacer: '\n' + entry.path + ':\n'});
                            queue_add(flist, isfeed);
                            if (self.curdepth > 0) {
                                return self.output(format(entry));
                            } else {
                                return self.state_func();
                            }
                        }
                    });
                }, {'oldest': self.since, 'limit': self.maxentries, 'reload': self.reload});
                return;
            } else {
                return self.output(format(entry));
            }
        } else {
            return self.exit(self.retval);
        }
    }

    function queue_add(entries, isfeed) {
        var sorted_entries = entries;

        if (isfeed === true) {
            sorted_entries = entries.sort(feed_sort);
        } else {
            sorted_entries = entries.sort(self.sort_func);
            if (self.docopts['-r']) {
                sorted_entries = sorted_entries.reverse();
            }
        }
        self.entries = self.entries.concat(sorted_entries);
    }

    function format(entry) {
        if (self.docopts['-l']) {
            if (entry.spacer) {
                return entry.spacer;
            }
            var file = entry.file,
                d = isdir(file) ? 'd' : '-',
                r = file.readable ? 'r' : '-',
                w = file.writable ? 'w' : '-',
                count,
                owner = (file.owner) ? file.owner.toString() : 'me',
                size = file.size || 0,
                time = (self.docopts['-c']) ? new Date(file.ctime) : new Date(file.mtime),
                datestr = lsdate(time),
                name = basenamedir(entry.path),
                out;

            if (file.count !== undefined) {
                count = file.count;
            } else {
                count = (d === 'd') ? Object.keys(file.files).length: 1;
            }
            out = sprintf('%1s%1s%1s %4d %-18s %8s %12s %s\n', d, r, w, count, owner.slice(0,18), size, datestr, name);
            return out;
        }

        if (self.docopts['-T']) {
            if (entry.spacer) {
                return entry.spacer;
            }
            return entry.path.split('/').pop();
        }
        if (self.docopts['-G']) {
            if (entry.spacer) {
                return null;
            }
            return entry.path + '\n';
        }
        if (entry.spacer) {
            return self.is_tty ? entry.spacer : null;
        }
        var c = $.extend({}, entry.file);
        if (c._mounted !== undefined || c.html === undefined) {
            c.html = '<div class="nativeFolder">' + basenamedir(entry.path) + '</div>';
        } else {
            c.html = c.html.replace(/\{\{\s*name\s*\}\}/g, basenamedir(entry.path));
        }
        c.html = '<div class="ls-item">' + c.html + '</div>';
        c._path = entry.path;
        return c;
    }

    if (self.state_func === null) {
        self.state_func = init;
    }
    return self.state_func();
}));

Command.register("ls", Ls);

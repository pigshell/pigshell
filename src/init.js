/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var initshell, termfs, uploadfs;
var pigshell_baseurl = '';

function pigshell_compatible() {
    return ($.browser.webkit || $.browser.mozilla) && !navigator.userAgent.match(/ipad|ipod|iphone/i);
}

function init(opts, cb) {
    var maindiv = opts.maindiv || '#pmain';

    /*
     * Firefox on Linux gives up saying 'too much recursion'. We need to
     * tune our soguard hack way, way down for Firefox.
     *
     * ES6 tail call optimization can't happen too fast.
     */

    if ($.browser.mozilla && !navigator.userAgent.match(/Mac OS/)) {
       _nstack_max = 1; 
    }

    sprintf['default'] = '';

    var ns;

    $('script').each(function() {
        if (this.src) {
            var src = this.src.toString();
            if (src.match(/pigshell.js/)) {
                pigshell_baseurl = URI.parse(src).resolve("./");
            }
        }
    });

    function mountroot(opts, cb) {
        var u = URI.parse(window.location.href),
            rooturi = opts.rooturi ? u.resolve(opts.rooturi) : u.resolve("root.tar"),
            sorry = "Error loading root filesystem at %s: %s",
            loading = "<br/>Loading root filesystem at %s...";

        function bail(err) {
            return cb(sprintf(sorry, rooturi, err_stringify(err)));
        }

        VFS.lookup_uri("ramfs://root/", {mount: true, mountopts: {}},
            function(err, res) {
            if (err) {
                return bail(err);
            }
            ns = new Namespace(fstack_base(res));
            initshell = new Shell({argv: ['init', '/etc/rc.sh'], ns: ns});

            VFS.lookup_uri(rooturi, {}, function(err, res) {
                if (err) {
                    return bail(err);
                }
                $('#loading').append(sprintf(loading, rooturi));
                untar(res, initshell.getcwd(), {context: initshell},
                    function(err, res) {
                    $('#loading').remove();
                    if (err) {
                        return bail(err);
                    }
                    return cb(null);
                });
            });
        });
    }

    function mountrest(opts, cb) {
        var sysfs = new JsonFS(Sys, {cache: false}),
            authfs = new JsonFS(Auth.authlist, {rootident: '/auth', cache: false}),
            lstorfs = new LstorFS(),
            devfs = new DevFS(),
            downloadfs = new DownloadFS();

        termfs = new PtermFS();
        uploadfs = new UploadFS();

        ns.mount('/local', lstorfs.root, {}, function(){});
        ns.mount('/sys', sysfs.root, {}, function(){});
        ns.mount('/auth', authfs.root, {}, function(){});
        ns.mount('/pterm', termfs.root, {}, function(){});
        ns.mount('/downloads', downloadfs.root, {}, function(){});
        ns.mount('/uploads', uploadfs.root, {}, function(){});
        ns.mount('/dev', devfs.root, {}, function(){});

        return cb(null);
    }

    function focus_cm(el, event) {
        var cm = el.data('codemirror');
        if (cm === undefined || cm.getOption('readOnly') === 'nocursor') {
            return true;
        }
        setTimeout(cm.focus.bind(cm), 0);
        event.stopPropagation();
        return true;
    }

    function handle_click(event) {
        /* Let text get selected */
        var target = $(event.target);
        if (target.hasClass('pt2') || target.parents(".pt2").length || target.hasClass('pmarkdown') || target.parents('.pmarkdown').length) {
            return true;
        }
        var inp = target.closest('.pterm-root').children(".pterm-cli").last();
        if (inp.length === 0) {
            inp = $(".pterm-cli").last();
            if (inp.length === 0) {
                return true;
            }
        }
        return focus_cm(inp, event);
    }
    if (opts.embedded) {
        $(document).on("click.pigshell", ".pterm-root", handle_click);
    } else {
        $(document).on("click.pigshell", handle_click);
    }

    mountroot(opts, ef(cb, function() {
        mountrest(opts, cb);
    }));
}

function run_initshell(opts, cb) {
    var hash = window.location.hash,
        hashopts = hash ? optstr_parse(hash.slice(1)) : {},
        maindiv = opts.maindiv || '#pmain',
        termdiv = $('<div class="pterm-root"/>').appendTo($(maindiv)),
        term = new Pterm({move: false}, termfs.root, termdiv),
        stdout = new Stdout({shell: initshell}, term);

    term.removable = false;
    initshell.ediv = mkediv(termdiv);
    if (hashopts.norc) {
        sys.putenv(initshell, 'norc', 1);
    }
    $(window).resize(function() {
        rescroll(termdiv);
    });
    $(document).click();

    stdout.fds.stdin = initshell;
    initshell.fds.stderr = term;
    stdout.next({}, function(err, res) {
        console.log(err, res);
        return cb(null);
    });
}
// SHELL END

function mountcloud(opts, cb) {
    startgoog(function() {});
    startfb(function() {});
    startdropbox(function() {});
    startupload(function() {});
    return cb(null);
}

function startfb(cb) {

// FACEBOOK BEGIN
// Load the SDK Asynchronously
(function(d) {
    var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement('script'); js.id = id; js.async = true;
    js.src = "//connect.facebook.net/en_US/all.js";
    ref.parentNode.insertBefore(js, ref);
 }(document));

// Init the SDK upon load
window.fbAsyncInit = function() {
    FB.init({
    appId      : '474078922609132', // App ID
    channelUrl : '//'+window.location.hostname+'/static/fbchannel.html', // Path to your Channel File
    status     : true, // check login status
    cookie     : true, // enable cookies to allow the server to access the session
    xfbml      : true  // parse XFBML
    });
    function set_fblogin() {
        $("#btnFB")
            .attr('data-content', '<div class="dspopover"><button type="button" class="btn btn-default fbaction">Connect Facebook</button></div>')
            .removeClass('fbenabled');
    }
    FB.Event.subscribe('auth.statusChange', function(response) {
        if (response.authResponse) {
            FB.api('/me', function(response) {
                $('#btnFB').data('authstatus', response.name)
                    .attr('data-content', '<div class="dspopover"><span>' + response.name + '</span>&nbsp;<button class="fbaction btn btn-default btn-xs">Logout</button></div>').addClass('fbenabled');
                var fbfs = new FacebookFS(response.name);
                initshell.ns.mount('/facebook', fbfs.root, {}, function(){});
            });
        } else {
            // user has not auth'd your app, or is not logged into Facebook
            set_fblogin();
        }
    });

    // respond to clicks on the FB login and logout links
    $(document).ready(function() {
    $('#btnFB').popover({container: 'body', html: true});
    set_fblogin();
    $('body').on('click', 'button.fbaction', function(){
        $('div.popover').removeClass('in').hide();
        if (!$('#btnFB').data('authstatus')) {
            FB.login(function(response) {}, {
                scope:
                    'user_videos,friends_videos,publish_actions,' +
                    'publish_stream,read_stream,' +
                    'photo_upload,video_upload,' +
                    'user_photos,friends_photos,' +
                    'user_location,friends_location,' +
                    'user_relationships,friends_relationships,' +
                    'user_birthday,friends_birthday,' +
                    'user_about_me,friends_about_me,' +
                    'user_status,friends_status,' +
                    'user_hometown,friends_hometown,' +
                    'user_religion_politics,friends_religion_politics'
            });
        } else {
            if(!confirm("Logout from Facebook?")) {
                return false;
            } else {
                FB.logout();
                initshell.ns.umount('/facebook', function(){});
                $('#btnFB').data('authstatus', '');
                set_fblogin();
            }
        }
    }); 
    });
};

}

// FACEBOOK END

// GOOGLE BEGIN
function startgoog(cb) {
    var loginbuttonstr = '<div class="dspopover"><button type="button" class="btn btn-default googlogin">Add Google Account</button></div>';

    function update_button() {
        var userlist = Object.keys(GoogleOAuth2.authdata.tokens),
            divstring = [];
        userlist.forEach(function(user) {
            var name = GoogleOAuth2.authdata.tokens[user].userinfo.email;
            divstring.push('<tr class="dspopover"><td>' + name + '</td><td><button class="googlogout btn btn-default btn-xs" data-email="' + user + '">Logout</button></td></tr>');
        });
        $('#btnGoog').attr('data-content', '<table class="dspopover">' + divstring.join(' ') + '</table>' + loginbuttonstr);
        if (userlist.length) {
            $('#btnGoog').addClass('googenabled');
        } else {
            $('#btnGoog').removeClass('googenabled');
        }
    }

    function handle_login(username, cb) {

        function mount_picasa(user, cb) {
            var mntpt = '/picasa/' + user.email;
            mkdir.call(initshell, mntpt, ef(cb, function() {
                mount_uri('https://picasaweb.google.com/data/feed/api/user/' + user.id + '/', mntpt, {user: user.email}, initshell, function(err){
                    if (err) { console.log(err); }
                    return cb(null);
                });
            }));
        }
        function mount_gdrive(user, cb) {
            var mntpt = '/gdrive/' + user.email;
            mkdir.call(initshell, mntpt, ef(cb, function() {
                mount_uri('https://www.googleapis.com/drive/v2/files/root', mntpt, {user: user.email}, initshell, function(err){
                    if (err) { console.log(err); }
                    return cb(null);
                });
            }));
        }
        GoogleOAuth2.login(username, {}, ef(cb, function(res) {
            update_button();
            mount_picasa(res.userinfo, function() {
                mount_gdrive(res.userinfo, cb);
            });
        }));
    }

    function handle_logout(email) {
        initshell.ns.umount('/gdrive/' + email, function(){});
        initshell.ns.umount('/picasa/' + email, function(){});
        GoogleOAuth2.logout(email, {}, function() {
            update_button();
        });
    }

    $('#btnGoog').popover({container: 'body', html: true});
    update_button();

    $('body').on('click', 'button.googlogin', function(){
        $('div.popover').removeClass('in').hide();
        handle_login('', function() {});
    });
    $('body').on('click', 'button.googlogout', function(){
        $('div.popover').removeClass('in').hide();
        var email = $(this).attr('data-email');
        handle_logout(email);
    });

    var userlist = GoogleOAuth2.cache_list_users();
    async.forEachSeries(userlist, function(user, acb) {
        handle_login(user, function() {
            return acb(null);
        });
    }, function(err) {
        return cb(null);
    });
}

function startdropbox(cb) {
    var loginbuttonstr = '<div class="dspopover"><button type="button" class="btn btn-default dropboxlogin">Add Dropbox Account</button></div>';

    function update_button() {
        var userlist = Object.keys(DropboxOAuth2.authdata.tokens),
            divstring = [];
        userlist.forEach(function(user) {
            var name = DropboxOAuth2.authdata.tokens[user].userinfo.email;
            divstring.push('<tr class="dspopover"><td>' + name + '</td><td><button class="dropboxlogout btn btn-default btn-xs" data-email="' + user + '">Logout</button></td></tr>');
        });
        $('#btnDropbox').attr('data-content', '<table class="dspopover">' + divstring.join(' ') + '</table>' + loginbuttonstr);
        if (userlist.length) {
            $('#btnDropbox').addClass('dropboxenabled');
        } else {
            $('#btnDropbox').removeClass('dropboxenabled');
        }
    }

    function handle_login(username, cb) {

        function mount_dropbox(user, cb) {
            var mntpt = '/dropbox/' + user.email;
            mkdir.call(initshell, mntpt, ef(cb, function() {
                mount_uri('https://api.dropbox.com/1/metadata/dropbox/', mntpt, {user: user.email}, initshell, function(err){
                    if (err) { console.log(err); }
                    return cb(null);
                });
            }));
        }
        DropboxOAuth2.login(username, {}, ef(cb, function(res) {
            update_button();
            mount_dropbox(res.userinfo, cb);
        }));
    }

    function handle_logout(email) {
        initshell.ns.umount('/dropbox/' + email, function(){});
        DropboxOAuth2.logout(email, {}, function() {
            update_button();
        });
    }

    $('#btnDropbox').popover({container: 'body', html: true});
    update_button();

    $('body').on('click', 'button.dropboxlogin', function(){
        $('div.popover').removeClass('in').hide();
        handle_login('', function() {});
    });
    $('body').on('click', 'button.dropboxlogout', function(){
        $('div.popover').removeClass('in').hide();
        var email = $(this).attr('data-email');
        handle_logout(email);
    });
    var userlist = DropboxOAuth2.cache_list_users();
    async.forEachSeries(userlist, function(user, acb) {
        handle_login(user, function() {
            return acb(null);
        });
    }, function(err) {
        return cb(null);
    });
}

// FILE UPLOAD START
function startupload(cb) {
    function handleFileSelect(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        uploadFiles(evt.dataTransfer ? evt.dataTransfer.files : evt.target.files);
    }

    function handleDragOver(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    }

    // Setup the dnd listeners.
    $('#fileSelect').click(function (e) {
            $('#files').click();
            e.preventDefault(); // prevent navigation to "#"
        });
    document.body.addEventListener('dragover', handleDragOver, false);
    document.body.addEventListener('drop', handleFileSelect, false);
    document.getElementById('files').
        addEventListener('change', handleFileSelect, false);

    /* read files from disk using file reader and add to uploads */
    function uploadFiles(files) {
        return uploadfs.root.populate(files, function(){});
    }
    return cb(null);
// FILE UPLOAD END
}

window.onerror = function (message, file, line, col) {
    console.log("window.onerror: ", message, "file: ", file, "line: ", line, "col: ", col);
    var current = proc.current(null);
    if (current instanceof Command) {
        console.log("Killing ", current);
        current.kill("Exception: " + message);
    } else {
        console.log("No-man's land: ", current);
        console.log("Exception: " + message);
    }
};

pigshell.init = init;
pigshell.mountcloud = mountcloud;
pigshell.run_initshell = run_initshell;
pigshell.compatible = pigshell_compatible;

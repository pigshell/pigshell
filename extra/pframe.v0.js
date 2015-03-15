/*
 * Pigshell frame communication protocol. Used for communicating with HTML
 * templates housed in iframes.
 *
 * WARNING: 1.0 API still in flux
 */

var pframe = (function() {
    var name = window.name || '',
        version = '1.0',
        proto = {debug: 0};

    if (!name.match(/^pframe:/)) {
        window.onload = function() {
            if (window.demo) {
                window.demo();
            }
        };
        return {};
    }

    var vcomps = version.split('.'),
        iframe_proto = {};

    try {
        iframe_proto = JSON.parse(name.slice('pframe:'.length));
    } catch(e) {
        return {};
    }

    var versions = iframe_proto.ver,
        msgs = iframe_proto.msg,
        vcompat = versions
            .map(function(v) { return v.split('.')[0] === vcomps[0]; })
            .reduce(function(a, b) { return a || b; }, false),
        mbox_capable = false;

    try {
        mbox_capable = !!window.parent.document;
    } catch(e) {}

    if (!vcompat) {
        sendmsg('exit', 'Protocol version not compatible');
        return {};
    }

    proto.ver = version;
    proto.cid = iframe_proto.cid || 'pframe_0';
    proto.origin = iframe_proto.origin;
    if (mbox_capable && msgs.indexOf('mbox') !== -1) {
        proto.msg = 'mbox';
        proto.mbox = window.parent.pframe_mbox[proto.cid];
        if (proto.mbox === undefined) {
            sendmsg('exit', 'mbox not found');
            return {};
        }
    } else if (msgs.indexOf('postMessage') !== -1) {
        proto.msg = 'postMessage';
    } else {
        sendmsg('exit', 'Protocol messaging not compatible');
        return {};
    }

    function unext(cb) {
        if (pframe.unext_pending) {
            return exit("pframe: already waiting for upstream item!");
        }
        pframe.unext_pending = cb;
        sendmsg('next');
    }

    function sendmsg(op, data) {
        var msg = {};
        msg[proto.cid] = {op: op, data: data};
        debug(2, "IFrame sending", op, data);
        window.parent.postMessage(msg, '*');
    }

    function output(item) {
        pframe.next_pending = false;
        
        if (proto.msg === 'mbox') {
            proto.mbox.inbox = item;
            item = undefined;
        }
        sendmsg('data', item);
    }

    function errmsg(item) {
        sendmsg('errmsg', item);
    }

    function exit(value) {
        pframe.done = true;
        sendmsg('exit', value);
    }

    function config(obj) {
        sendmsg('config', obj);
    }

    function read(cb) {
        var items = [];
        function next() {
            return unext(function(res) {
                if (res === null) {
                    return cb(items);
                } else {
                    items.push(res);
                    return next();
                }
            });
        }
        return next();
    }

    function debug() {
        var args = [].slice.call(arguments, 1);
        if (proto.debug >= arguments[0]) {
            console.log(args);
        }
    }

    window.addEventListener('message', function(e) {
        debug(3, "IFrame message", e.data);
        var msg = e.data instanceof Object ? e.data[proto.cid] : undefined;
        if (e.origin !== proto.origin || msg === undefined) {
            return;
        }

        var op = msg.op,
            data = msg.data;

        debug(2, "IFrame received", op, msg);
        if (pframe.done) {
            console.log("unexpected message after exit:", op, data);
            return;
        }
        if (op === 'data') {
            if (!pframe.unext_pending) {
                console.log("unexpected data ", data);
                return exit("pframe: unexpected data");
            }
            var cb = pframe.unext_pending;
            pframe.unext_pending = null;
            if (proto.msg === 'mbox') {
                data = proto.mbox.outbox;
                proto.mbox.outbox = undefined;
                if (data === undefined) {
                    return exit('iframe broke mbox protocol');
                }
            }
            return cb(data);
        } else if (op === 'next') {
            if (pframe.next_pending) {
                return exit("pframe: unexpected next");
            }
            pframe.next_pending = true;
            return pframe.onnext();
        } else if (op === 'config') {    
            return pframe.onconfig(data);
        } else {
            console.log("Unknown message:", op);
        }
    });

    window.onerror = function (message, file, line, col) {
        console.log("window.onerror: ", message, "file: ", file, "line: ", line, "col: ", col);
        return exit("Exception: " + message);
    };

    debug(1, "IFrame got proto", proto);
    config({proto: proto});

    return {
        proto: proto,
        onnext: function() { return exit("pframe: no onnext handler"); },
        onconfig: function() {/*console.log("pframe: no onconfig handler");*/},
        unext: unext,
        read: read,
        output: output,
        errmsg: errmsg,
        config: config,
        exit: exit,
        next_pending: false,
        unext_pending: false,
        done: false
    };
})();

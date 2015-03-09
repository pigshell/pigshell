/*
 * Pigshell frame communication protocol. Used for communicating with HTML
 * templates housed in iframes.
 *
 * WARNING: 1.0 API still in flux
 */

var pframe = (function() {
    var name = window.name || '',
        version = '1.0',
        proto = {};

    if (name.match(/^pigshell_frame:/)) {
        var vcomps = version.split('.'),
            jframe_proto = {};
        try {
            jframe_proto = JSON.parse(name.slice('pigshell_frame:'.length));
        } catch(e) {
            return {};
        }
        var versions = jframe_proto.ver,
            msgs = jframe_proto.msg,
            vcompat = versions
                .map(function(v) { return v.split('.')[0] === vcomps[0]; })
                .reduce(function(a, b) { return a || b; }, false),
            mbox_capable = false;
        try {
            mbox_capable = !!window.parent.pigshell;
        } catch(e) {}
        if (vcompat && mbox_capable && msgs.indexOf('mbox') !== -1) {
            proto.ver = version;
            proto.msg = 'mbox';
            proto.mbox = window.parent.pframe_mbox[jframe_proto.mbox_id];
            if (proto.mbox === undefined) {
                window.parent.postMessage({op: 'exit', data: 'mbox not found'});
                return {};
            }
        } else if (vcompat && msgs.indexOf('postMessage') !== -1) {
            proto.ver = version;
            proto.msg = 'postMessage';
        } else {
            window.parent.postMessage({op: 'exit', data: 'Unsupported proto'}, '*');
            return {};
        }
    } else {
        window.onload = function() {
            if (window.demo) {
                window.demo();
            }
        };
        return {};
    }

    function unext(cb) {
        if (pframe.unext_pending) {
            return exit("pframe: already waiting for upstream item!");
        }
        pframe.unext_pending = cb;
        window.parent.postMessage({op: 'next'}, '*');
    }

    function output(item) {
        pframe.next_pending = false;
        
        if (pframe.proto.msg === 'mbox') {
            pframe.proto.mbox.inbox = item;
            item = undefined;
        }
        window.parent.postMessage({op: 'data', data: item}, '*');
    }

    function errmsg(item) {
        window.parent.postMessage({op: 'errmsg', data: item}, '*');
    }

    function exit(value) {
        pframe.done = true;
        window.parent.postMessage({op: 'exit', data: value}, '*');
    }

    function config(obj) {
        window.parent.postMessage({op: 'config', data: obj}, '*');
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

    window.addEventListener('message', function(e) {
        var msg = e.data,
            op = msg.op,
            data = msg.data;

        //console.log("FRAMERECV", op, data);
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
            if (pframe.proto.msg === 'mbox') {
                data = pframe.proto.mbox.outbox;
                pframe.proto.mbox.outbox = undefined;
                if (data === undefined) {
                    return exit('jframe broke mbox protocol');
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

    config({proto: proto});

    return {
        proto: proto,
        ondata: null,
        onnext: function() { return exit("pframe: no onnext handler"); },
        onconfig: function() { return exit("pframe: no onconfig handler"); },
        unext: unext,
        read: read,
        output: output,
        errmsg: errmsg,
        config: config,
        exit: exit,
        next_pending: false,
        unext_pending: false,
        done: false,
        version: version
    };
})();

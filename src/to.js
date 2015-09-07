/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * Conversion from one type to another. Only supports basic types.
 * I'm sure we can do something clever here, like finding a chain
 * of translators and composing them with cunning function combinators.
 * However.
 */

function _compose(f1, f2) {
    function func(item, opts, cb) {
        function f1cb(err, res) {
            if (err) {
                return cb(err);
            }
            return f2(res, opts, cb);
        }
        return f1(item, opts, f1cb);
    }
    return func;
}

var Converters = {
    'text':         {
                        'blob': text2blob,
                        'arraybuffer': _compose(text2blob, blob2ab),
                        'text': passthrough,
                        'lines': text2lines,
                        'base64': text2base64,
                        'canvas': text2canvas,
                        'object': text2object
                    },
    'blob':         {
                        'canvas': blob2canvas,
                        'text': blob2text,
                        'lines': _compose(blob2text, text2lines),
                        'arraybuffer': blob2ab,
                        'blob': passthrough,
                        'test': blob2test,
                        'base64': _compose(blob2ab, ab2base64),
                        'object': _compose(blob2text, text2object)
                    },
    'canvas':       {
                        'blob': canvas2blob,
                        'arraybuffer': _compose(canvas2blob, blob2ab),
                        'canvas': passthrough
                    },
    'arraybuffer':  {
                        'blob': ab2blob,
                        'arraybuffer': passthrough,
                        'base64': ab2base64
                    },
    'array':        {
                        'blob': array2blob,
                    },
    'object':       {
                        'object': passthrough,
                        'text': object2text
                    }
};

function to(dtype, item, opts, cb) {
    var ftypes = Object.keys(Converters),
        stype = '';

    if (item instanceof Array) {
        stype = 'array';
    } else if (isstring(item)) {
        stype = 'text';
    } else if (item.constructor === HTMLCanvasElement) {
        stype = 'canvas';
    } else if (item instanceof Blob) {
        stype = 'blob';
    } else if (item.constructor === Object) {
        stype = 'object';
    } else {
        // TODO Handle arraybuffers some day
        return cb('Converter not found for item');
    }
    var func = Converters[stype][dtype];
    if (func) {
        return func(item, opts, cb);
    }
    return cb('Converter not found for ' + stype + ' to ' + dtype);
}

function passthrough(item, opts, cb) {
    return cb(null, item);
}

function text2object(item, opts, cb) {
    var obj = parse_json(item);
    if (!obj) {
        return cb("JSON parsing error");
    } else {
        return cb(null, obj);
    }
}

function object2text(item, opts, cb) {
    return cb(null, JSON.stringify(item));
}

function blob2text(item, opts, cb) {
    var fr = new FileReader();

    fr.onload = setcur(function(e) {
        return cb(null, e.target.result);
    });
    fr.onerror = setcur(function(e) {
        return cb('blob2text eror');
    });
    fr.readAsText(item);
    proc.current(null);
}

function text2lines(item, opts, cb) {
    if (!isstring(item)) {
        return cb("Not a string");
    }
    var linesep = opts.linesep || '\n',
        lines = item.split(linesep),
        last = lines.pop();

    lines = lines.map(function(m) { return m + '\n'; });
    if (last) {
        lines.push(last);
    }
    return cb(null, lines);
}

function blob2canvas(item, opts, cb) {
    var ourl = window.URL || window.webkitURL;
    if (!ourl) {
        return cb({msg: "Browser lacks createObjectURL"});
    }
    var img = new Image(),
        canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
    
    img.crossOrigin = "Anonymous";
    img.onload = setcur(function() {
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0);
        ourl.revokeObjectURL(img.src);
        return cb(null, canvas);
    });
    img.onerror = setcur(function() {
        ourl.revokeObjectURL(img.src);
        return cb('blob2canvas error');
    });
    img.src = ourl.createObjectURL(item);
    proc.current(null);
}

function blob2test(item, opts, cb) {
    var fr = new FileReader(),
        timeout = opts.timeout || 0;


    fr.onload = function(e) {
        var cb2 = function() {
            if (opts.setcur) {
                proc.current(cur);
            }
            return cb(null, e.target.result);
        };
        setTimeout(cb2, timeout * 1000);
    };

    fr.onerror = setcur(function(e) {
        return cb('blob2text eror');
    });
    fr.readAsText(item);
    var cur = proc.current(null);
}

/*
 * Converts SVG string to canvas. Chrome, FF can be directly converted
 * but Safari needs canvg. We try the direct method first, and if it fails,
 * switch over to canvg.
 */

function text2canvas(item, opts, cb) {
    if (text2canvas.mode === 'canvg') {
        var canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d');

        canvas.height = opts.height;
        canvas.width = opts.width;
        ctx.drawSvg(item, 0, 0);
        return cb(null, canvas);
    }

    var img = new Image(),
        canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
    
    img.crossOrigin = "Anonymous";
    img.onload = setcur(function() {
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0);
        return cb(null, canvas);
    });
    img.onerror = setcur(function() {
        loadjs(["extra/StackBlur.js", "extra/rgbcolor.js", "extra/canvg.js"],
            {}, function(err, res) {
            if (err) {
                return cb("text2canvas: loading canvg failed");
            }
            text2canvas.mode = 'canvg';
            return text2canvas(item, opts, cb);
        });
    });
    img.src = "data:image/svg+xml," + item;
    proc.current(null);
}

function text2blob(item, opts, cb) {
    return cb(null, new Blob([item], {"type": "text/plain"}));
}

function blob2ab(item, opts, cb) {
    var fr = new FileReader();

    fr.onload = setcur(function(e) {
        return cb(null, e.target.result);
    });
    fr.onerror = setcur(function(e) {
        return cb('blob2text eror');
    });
    fr.readAsArrayBuffer(item);
    proc.current(null);
}

function canvas2blob(item, opts, cb) {
    item.toBlob(setcur(function(blob) {
        return cb(null, blob);
    }));
    proc.current(null);
}

function ab2blob(item, opts, cb) {
    var mime = opts.mime || "application/octet-stream";
    return cb(null, new Blob([item], {"type": mime}));
}

/* oddball - isn't in the matrix above */
function base642blob(item, opts) {
    var raw = atob(item),
        a = new Array(raw.length),
        mime = (opts && opts.mime) ? opts.mime : "application/octet-stream";

    for (var i = 0; i < raw.length; i++) {
        a[i] = raw.charCodeAt(i);
    }

    var ab = new Uint8Array(a),
        blob = new Blob([ab], {"type": mime});
    return blob;
}

function ab2base64(item, opts, cb) {
    var str = '',
        view = new Uint8Array(item),
        len = view.byteLength;

    for (var i = 0; i < len; i++) {
        str += String.fromCharCode(view[i]);
    }
    return cb(null, btoa(str));
}

function text2base64(item, opts, cb) {
    return cb(null, btoa(item));
}

/*
 * Convert a list of objects to a blob. Typically used by putdir()s
 */

function array2blob(clist, opts, cb) {
    var first = clist[0],
        mime = opts.mime || '';

    if (clist.length === 0) {
        return cb(null, new Blob([''], {type: 'application/octet-stream'}));
    }
    if (isstring(first)) { // treat the whole array as a single text file
        var content = clist.join('');
        return cb(null, new Blob(clist, {type: mime || 'text/plain'}));
    } else if (first.constructor === HTMLCanvasElement) {
            first.toBlob(
                setcur(function(blob) { return cb(null, blob); }),
                mime || getMimeFromExtension(opts.name || '') || "image/png");
    } else {
        if (clist[0] instanceof Blob) {
            mime = mime || clist[0].type;
        }
        return cb(null, new Blob(clist, {type: mime || 'application/octet-stream'}));
    }
    proc.current(null);
}

/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var Magic = {
    probe: function(blob, cb) {
        to('arraybuffer', blob, {}, ef(cb, function(ab) {
            var bytes = new Uint8Array(ab);

            function cmp(m, b) {
                var s = m.str,
                    off = m.off;
                for (var j = 0, len = s.length; j < len; j++) {
                    if (b[off + j] !== s.charCodeAt(j)) {
                        return false;
                    }
                }
                return true;
            }
            for (var i = 0, max = Magic.magiclist.length; i < max; i++) {
                var m = Magic.magiclist[i];
                if (cmp(m, bytes)) {
                    if (m.mime === 'application/zip') {
                        return Magic._zip_probe(bytes, cb);
                    } else {
                        return cb(null, m.mime, m.desc);
                    }
                }
            }
            return cb(E('ENOENT'));
        }));
    },

    /* Probe zip file to check for MS Office. */
    _zip_probe: function(bytes, cb) {
        var mime = 'application/zip',
            officemimes = {
                'xl': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'word': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'ppt': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            };
        
        var unzip, filenames = [];
        try {
            unzip = new Zlib.Unzip(bytes);
            if (unzip) {
                filenames = unzip.getFilenames();
            }
        } catch (e) { console.log(e.message); }
        if (filenames.indexOf("[Content_Types].xml") !== -1) {
            for (var i = 0, len = filenames.length; i < len; i++) {
                var m = filenames[i].match(/^(xl|word|ppt)\//);
                if (m) {
                    return cb(null, officemimes[m[1]]);
                }
            }
        }
        return cb(null, mime);
    }
};

Magic.magiclist = [
    {off: 0, str: "PK\x03\x04", mime: "application/zip", desc: "Zip archive data"},
    {off: 0, str: "\xff\xd8", mime: "image/jpeg", desc: "JPEG image data"},
    {off: 0, str: "\x89PNG\x0d\x0a\x1a\x0a", mime: "image/png", desc: "PNG image data"},
    {off: 0, str: "GIF8", mime: "image/gif", desc: "GIF image data"},
    {off: 0, str: "%PDF-", mime: "application/pdf", desc: "PDF document"}
];

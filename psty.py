#!/usr/bin/env python

"""
Psty HTTP Server. The P is silent, as in Psmith.

Psty does three things:
    - Exposes local FS to pigshell.
    - Proxy HTTP(s) server for pigshell's Ajax requests to jump the same-origin
      barrier
    - Websocket server to let pigshell pipe data through Unix commands

Psty is deliberately structured as a single file depending only on a standard
Python 2.7 installation. This makes it easy to use and easy to read. 

Won't work on Windows without some porting.

Copyright (C) 2013-2014 by Coriolis Technologies Pvt Ltd.
This program is free software - see the file COPYING for license details.

"""

__version__ = "0.5"

import os
import sys
import getopt
import errno
import stat
import select
import struct
import socket
import subprocess
import posixpath
import BaseHTTPServer
import SocketServer
import urllib
import urlparse
import cgi
import mimetypes
import json
import base64
import re
import traceback
from httplib import HTTPConnection, HTTPSConnection
from hashlib import sha1, md5
from cookielib import CookieJar, Cookie
from urllib2 import Request
import sqlite3


try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

psty_options = {

    "allow_delete": True,        # Make this true to allow rm
    "follow_symlinks": False,    # TODO Symlinks are followed outside cwd
    "enable_fileserver": False,  # Enable exporting current directory via Psty
                                 # protocol
    "export_path": os.getcwd(),  # Directory exported via fileserver
    "enable_wsh": False,         # Enables remote command execution over
                                 # websocket
    "enable_proxy": False,       # Enable proxy
    "enable_cookies": False,     # Borrow cookies from Chrome/Firefox,
                                 # set False to disable sending all cookies
    "cors_allow": "http://dev.pigshell.com"

# Change the cors_allow setting if you are running pigshell on your own
# site. *** DO NOT, UNDER ANY CIRCUMSTANCES, SET THIS TO '*'. ***
# That will allow any site you visit to access your data and use your
# proxy.

}

BUFLEN = 8192
SELECT_TIMEOUT = 3
PROXY_CORS_HEADER = "Access-Control-Allow-Origin: %s\r\n" + \
                    "X-Psty-Location: %s\r\n" + \
                    "Access-Control-Expose-Headers: Content-Length, Content-Range, X-Psty-Location\r\n"

DIRMIME = 'application/vnd.pigshell.dir'
FILEMIME = 'application/vnd.pigshell.pstyfile'
LINKMIME = 'application/vnd.pigshell.link'


class PException(Exception):
    def __init__(self, code, response):
        self.code = code
        self.msg = response


class WException(Exception):
    def __init__(self, code):
        self.code = code

def guard(f):
    def decorator(self, *args, **kwargs):
        origin = self.headers.getheader("origin") or self.headers.getheader("referer") or ""
        if not origin or origin.find(psty_options["cors_allow"]) != 0:
            self.send_error(403, "Bad origin")
        if self.proxy_re.match(self.path):
            if not psty_options["enable_proxy"]:
                return self.send_error(403, "Proxy service not enabled")
            if self.command == 'OPTIONS':
                return f(self, *args, **kwargs)
            return self.do_proxy()
        upgrade = self.headers.getheader("upgrade")
        if self.command == 'GET' and upgrade and upgrade.lower() == "websocket":
            if not psty_options["enable_wsh"]:
                return self.send_error(403, "Websocket service not enabled")
            return self.do_websocket()
        if not psty_options["enable_fileserver"]:
            return self.send_error(403, "Fileserver not enabled")
        return f(self, *args, **kwargs)

    return decorator


class PstyRequestHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    server_version = "Psty/" + __version__
    proxy_address = None
    proxy_re = re.compile(r'^/(http|https|ftp)')

    # use unbuffered readlines - we don't want anything remaining in the
    # buffer when we go into our select()/recv() loop
    rbufsize = 0

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", psty_options["cors_allow"])
        self.send_header("Access-Control-Expose-Headers",
                         "Content-Length, Content-Range")

    @guard
    def do_OPTIONS(self):
        self.send_response(200)
        rh = self.headers.getheader("access-control-request-headers")
        headers = [("Access-Control-Allow-Origin", psty_options["cors_allow"]),
                   ("Access-Control-Allow-Methods", "DELETE, POST, PUT, GET, OPTIONS"),
                   ("Access-Control-Allow-Headers", rh),
                   ("Access-Control-Max-Age", 864000),
                   ("Connection", "close")]

        for h in headers:
            self.send_header(h[0], h[1])

        self.end_headers()

    @guard
    def do_DELETE(self):
        self.send_error(403, "DELETE not implemented")

    @guard
    def do_GET(self):
        """Serve a GET request."""
        self.send_head()

    @guard
    def do_HEAD(self):
        """Serve a HEAD request."""
        self.send_head()

    def op_mkdir(self, fs):
        filename = fs['filename'].value
        if filename.find('/') != -1:
            raise Exception("Invalid filename")

        path = os.path.join(self.fspath, filename)
        os.mkdir(path)
        # We should be doing a 201 Created and sending the dir as a response
        # body like in op_put, but lazy for now
        self.send_json_response(rcode=204)

    def op_rm(self, fs):
        """
        Remove file or directory
        """
        if not psty_options["allow_delete"]:
            return self.send_error(403, "Deletion not allowed")

        filename = fs['filename'].value
        if filename.find('/') != -1:
            raise Exception("Invalid filename")

        path = os.path.join(self.fspath, filename)
        if os.path.isdir(path):
            os.rmdir(path)
        else:
            os.remove(path)
        self.send_json_response(rcode=204)

    def op_link(self, fs):
        data = fs['data'].value
        name = fs['name'].value
        try:
            meta = json.loads(data)
            ident = meta['ident']
        except:
            raise PException(400, "Bad request")
        os.symlink(ident, os.path.join(self.fspath, name))
        self.send_json_response(rcode=204)

    def op_put(self, fs):
        """
        Write to file, truncating existing one if necessary
        """
        filename = fs['filename'].value
        if filename.find('/') != -1:
            raise Exception("Invalid filename")
        data = fs['data'].file

        fspath = os.path.join(self.fspath, filename)
        urlpath = os.path.join(self.urlpath, filename)
        with open(fspath, 'wb') as f:
            self.copyfile(data, f)

        entry = self.get_pathinfo(fspath, urlpath, filename)
        self.send_json_response(entry, rcode=201, location=urlpath,
                                ctype=FILEMIME, lm=entry["mtime"] / 1000)

    def op_append(self, fs):
        """
        Append to file
        """
        data = fs['data'].file

        with open(self.fspath, 'ab') as f:
            self.copyfile(data, f)

        entry = self.get_pathinfo(self.fspath, self.urlpath, self.filename)
        self.send_json_response(entry, rcode=200, location=self.urlpath,
                                ctype=FILEMIME, lm=entry["mtime"] / 1000)

    def op_rename(self, fs):
        x, srcpath, x, x = self.translate_path(fs['src'].value)
        x, dstpath, x, x = self.translate_path(fs['dst'].value)

        os.rename(srcpath, dstpath)
        self.send_json_response(rcode=204)

    def get_pathinfo(self, fspath, urlpath, filename):
        entry = {}
        sf = os.lstat(fspath)
        if stat.S_ISLNK(sf.st_mode):
            link = os.readlink(fspath)
            ctype = LINKMIME
            entry["href"] = link
        else:
            ctype = self.get_mime(fspath)

        ident = urllib.quote(urlpath)
        if ctype == DIRMIME and not ident.endswith('/'):
            ident = ident + '/'
        entry.update({"name": filename, "ident": ident, "size": sf.st_size,
                      "mtime": sf.st_mtime * 1000, "atime": sf.st_atime * 1000,
                      "mime": ctype, "readable": readable(sf),
                      "writable": writable(sf)})
        return entry

    def send_json_response(self, data=None, rcode=200, location=None,
                           ctype=None, lm=None, cc="private, no-cache"):
        self.send_response(rcode)
        lm = None if lm is None else self.date_time_string(lm)
        for k, v in [("Location", location), ("Content-Type", ctype),
                     ("Last-Modified", lm), ("Cache-Control", cc)]:
            if v:
                self.send_header(k, v)

        self.send_cors_headers()
        self.send_header("Connection", "close")
        if 200 <= rcode < 300:
            self.send_header("Accept-Ranges", "bytes")
        if data is None:
            self.end_headers()
            return
        f = StringIO()
        f.write(json.dumps(data))
        length = f.tell()
        f.seek(0)
        self.send_header("Content-Length", str(length))
        self.end_headers()
        self.copyfile(f, self.wfile)
        f.close()

    def op_stat(self):
        """
        Return metadata of a file
        """
        if os.path.isdir(self.fspath):
            entry, mtime = self.list_directory()
            del entry["files"]
            ctype = DIRMIME
        else:
            entry = self.get_pathinfo(self.fspath, self.urlpath, self.filename)
            mtime = entry["mtime"] / 1000
            ctype = FILEMIME
        self.send_json_response(entry, rcode=200, location=self.urlpath,
                                ctype=ctype, lm=mtime)

    @guard
    def do_POST(self):
        self.set_paths()
        try:
            ctype, pdict = cgi.parse_header(self.headers.getheader("content-type"))
            if ctype != 'multipart/form-data':
                raise PException(403, "Unexpected content type")

            # Default rfile is unbuffered so the select() loop paths don't
            # miss data. Here we use a buffered rfile as recvfrom()ing a huge
            # payload 1 byte at a time is very expensive in time and CPU.
            rfile = self.connection.makefile()

            fs = cgi.FieldStorage(fp=rfile, headers=self.headers,
                                  environ={'REQUEST_METHOD': 'POST'})
            op = fs['op'].value
            if not hasattr(self, 'op_' + op):
                raise PException(403, "Invalid op")
            method = getattr(self, 'op_' + op)
            method(fs)
        except PException, e:
            print "PEXCEPT %s %s" % (e.code, e.msg)
            self.send_error(e.code, e.msg)
        except Exception, e:
            print "EXCEPT", str(e)
            print traceback.print_exc()
            if hasattr(e, 'errno'):
                self.send_error(403, errno.errorcode[e.errno])
            else:
                self.send_error(500, "Server exception")

    def send_head_dir(self):
        dirinfo, maxmtime = self.list_directory()
        #dts = self.date_time_string(maxmtime)
        #if self.headers.getheader('if-modified-since') == dts:
        #    self.send_json_response(rcode=304)
        #    return

        data = dirinfo if self.command == 'GET' else None
        self.send_json_response(data, rcode=200, ctype=DIRMIME, lm=maxmtime)

    def get_range(self):
        rh = self.headers.getheader('range') or ''
        m = re.match(r'bytes=([0-9]+)-([0-9]+)?', rh.strip())
        if m:
            g = m.groups()
            end = -1 if g[1] is None else int(g[1])
            return [int(g[0]), end]
        return None

    def send_head(self):
        self.set_paths()
        try:
            if self.urlquery.get('op', None):
                op = self.urlquery['op'][0]
                if not hasattr(self, 'op_' + op):
                    raise PException(403, "Invalid op")
                method = getattr(self, 'op_' + op)
                return method()

            if os.path.isdir(self.fspath):
                if self.urlpath.endswith('/'):
                    return self.send_head_dir()
                    # redirect browser - doing basically what apache does
                comps = list(urlparse.urlsplit(self.path))
                comps[2] = comps[2] + '/'
                redir = urlparse.urlunparse(comps)
                self.send_json_response(rcode=301, location=redir)
                return

            sf = os.lstat(self.fspath)
            if not readable(sf):
                raise PException(403, "Permission denied")

            #dts = self.date_time_string(os.lstat(path).st_mtime)
            #if self.headers.getheader('if-modified-since') == dts:
            #    self.send_json_response(rcode=304)
            #    return

            entry = self.get_pathinfo(self.fspath, self.urlpath, self.filename)
            my_range = self.get_range()
            filesize = entry["size"]
            if my_range:
                if my_range[1] == -1:
                    my_range[1] = filesize - 1
                if my_range[0] < 0 or my_range[0] > filesize - 1 or my_range[1] > filesize - 1 or my_range[1] < 0 or \
                        my_range[1] < my_range[0]:
                    self.send_error(416, headers=[("Content-Range", "*/" + str(filesize))])
                    return
                self.send_response(206)
                self.send_header("Content-Range", "bytes %d-%d/%d" % (my_range[0], my_range[1], filesize))
            else:
                my_range = (0, filesize - 1)
                self.send_response(200)

            reqsize = my_range[1] - my_range[0] + 1
            self.send_header("Cache-Control", "private, no-cache")
            self.send_header("Connection", "close")
            self.send_header("Content-type", entry["mime"])
            self.send_header("Content-Length", str(reqsize))
            self.send_header("Last-Modified", self.date_time_string(entry["mtime"] / 1000))
            self.send_cors_headers()
            self.end_headers()
            if self.command == 'GET':
                if stat.S_ISLNK(sf.st_mode):
                    f = StringIO()
                    f.write(os.readlink(self.fspath))
                    f.seek(0)
                else:
                    f = open(self.fspath, 'rb')
                written = self.copyfile(f, self.wfile, file_range=my_range)
                f.close()
        except PException, e:
            print "PEXCEPT %s %s" % (e.code, e.msg)
            self.send_error(e.code, e.msg)
        except Exception, e:
            print "EXCEPT", str(e)
            traceback.print_exc()
            if hasattr(e, 'errno'):
                if e.errno == errno.EPERM:
                    self.send_error(401, "Permission denied")
                self.send_error(404, "File not found")
            else:
                self.send_error(500, "Server exception")

    def send_error(self, code, message=None, headers=None):
        """
        Copied from BaseHttpServer. Need to add CORS headers even to
        error response.
        """

        try:
            short, long_code = self.responses[code]
        except KeyError:
            short, long_code = '???', '???'
        if message is None:
            message = short
        explain = long_code
        self.log_error("code %d, message %s", code, message)
        # using _quote_html to prevent Cross Site Scripting attacks (see bug #1100201)
        content = (self.error_message_format %
                   {'code': code, 'message': _quote_html(message), 'explain': explain})
        self.send_response(code, message)
        self.send_header("Content-Type", self.error_content_type)
        self.send_header('Connection', 'close')
        self.send_cors_headers()
        if headers:
            for h in headers:
                self.send_header(h[0], h[1])

        self.end_headers()
        if self.command != 'HEAD' and code >= 200 and code not in (204, 304):
            self.wfile.write(content)

    def list_directory(self):
        try:
            file_list = os.listdir(self.fspath)
        except:
            raise PException(404, "No permission to list directory")
        file_list.sort(key=lambda a: a.lower())
        files = []
        siglist = []
        maxmtime = 0
        for name in file_list:
            fullname = os.path.join(self.fspath, name)
            relname = os.path.join(self.urlpath, name)
            sf = os.lstat(fullname)
            if not (stat.S_ISREG(sf.st_mode) or stat.S_ISDIR(sf.st_mode) or stat.S_ISLNK(sf.st_mode)):
                continue
            entry = self.get_pathinfo(fullname, relname, name)
            if entry["mtime"] > maxmtime:
                maxmtime = entry["mtime"]
            files.append(entry)
            siglist.append("%s%d%d" % (entry["name"], entry["size"], entry["mtime"]))

        dirinfo = self.get_pathinfo(self.fspath, self.urlpath, self.filename)
        if dirinfo["mtime"] > maxmtime:
            maxmtime = dirinfo["mtime"]
        siglist.append("%s%d%d" % (dirinfo["name"], dirinfo["size"], dirinfo["mtime"]))
        dirinfo["files"] = files
        #dirinfo["cookie"] = str(maxmtime / 1000)
        dirinfo["cookie"] = md5("".join(sorted(siglist))).hexdigest()
        return dirinfo, maxmtime / 1000

    def translate_path(self, path):
        """Translate a /-separated PATH to the local filename syntax.

        Components that mean special things to the local file system
        (e.g. drive or directory names) are ignored.  (XXX They should
        probably be diagnosed.)

        """
        # TODO Symlink verification
        pathcomps = urlparse.urlsplit(path)
        urlpath = urllib.unquote(pathcomps.path)
        querystr = pathcomps.query
        urlquery = urlparse.parse_qs(querystr, keep_blank_values=True)
        posix_path = posixpath.normpath(urlpath)
        words = posix_path.split('/')
        words = filter(None, words)
        fspath = psty_options["export_path"]
        for word in words:
            drive, word = os.path.splitdrive(word)
            head, word = os.path.split(word)
            if word in (os.curdir, os.pardir):
                continue
            fspath = os.path.join(fspath, word)
        filename = os.path.basename(posix_path) or '/'
        return urlpath, fspath, urlquery, filename

    def set_paths(self):
        self.urlpath, self.fspath, self.urlquery, self.filename = self.translate_path(self.path)

    def copyfile(self, source, outputfile, file_range=None, buflen=16 * 1024):
        left = sys.maxint
        written = 0
        if file_range:
            left = file_range[1] - file_range[0] + 1
            source.seek(file_range[0])
        while left > 0:
            rlen = left if left < buflen else buflen
            buf = source.read(rlen)
            if not buf:
                break
            outputfile.write(buf)
            left -= len(buf)
            written += len(buf)

        return written

    def guess_type(self, path):
        """Guess the type of a file.

        Argument is a PATH (a filename).

        Return value is a string of the form type/subtype,
        usable for a MIME Content-type header.

        The default implementation looks the file's extension
        up in the table self.extensions_map, using application/octet-stream
        as a default; however it would be permissible (if
        slow) to look inside the data to make a better guess.

        """

        if os.path.isdir(path):
            return DIRMIME

        base, ext = posixpath.splitext(path)
        if ext in self.extensions_map:
            return self.extensions_map[ext]
        ext = ext.lower()
        if ext in self.extensions_map:
            return self.extensions_map[ext]
        else:
            return self.extensions_map['']

    if not mimetypes.inited: # try to read system mime.types
        mimetypes.init()
    extensions_map = mimetypes.types_map.copy()
    extensions_map.update({
        '': 'application/octet-stream', # Default
        '.py': 'text/plain',
        '.c': 'text/plain',
        '.h': 'text/plain',
        '.js': 'text/plain',
    })

    def get_mime(self, path):
        sf = os.stat(path)
        if stat.S_ISDIR(sf.st_mode):
            return DIRMIME
        try:
            output = subprocess.check_output(["file", "--mime-type", path])
            mime = output.split(': ')[-1].strip()
        except:
            mime = self.guess_type(path)
        return mime

    def proxy_transform_header(self, header):
        path = self.path[1:]
        comps = header.split(': ')
        name = comps[0].lower()
        if name in ("alternate-protocol", "access-control-allow-origin"):
            return None
        elif name == "set-cookie":
            # Add cookie to cookie jar object and don't return to browser
            if psty_options["enable_cookies"]:
                cookiejar.store_cookie(header, path)
            return None

        elif name == "location" and self._pstatus / 100 == 3:
            # XHR redirects are transparently handled by the browser without
            # notifying the XHR caller. We doctor 3xx Location headers
            # so the browser comes back to the proxy for the redirected URL
            if not urlparse.urlsplit(comps[1]).scheme:
                comps[1] = urlparse.urljoin(path, comps[1])
            comps[1] = "http://%s:%d/" % self.proxy_address + comps[1]
        elif name == "connection":
            comps[1] = "close\r\n"
        return ": ".join(comps)

    def do_shutdown(self):
        # Shutdown and bleed the socket dry in RFC-approved manner
        try:
            self.connection.shutdown(socket.SHUT_WR)
            while 1:
                data = self.connection.recv(BUFLEN)
                if len(data) == 0:
                    break
            self.connection.close()
        except:
            pass

    def do_websocket(self):
        if not psty_options["enable_wsh"]:
            return self.send_error(403, "Websocket shell not enabled")
        key = self.headers.getheader("sec-websocket-key")
        version = self.headers.getheader("sec-websocket-version")
        if version != "13":
            self.send_error(404) # TODO Figure out the RFC way to say FO

        self.set_paths()

        sha_hash = sha1(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest()
        self.send_response(101)
        self.send_header("Connection", "Upgrade")
        self.send_header("Upgrade", "WebSocket")
        self.send_header("Sec-WebSocket-Accept", base64.b64encode(sha_hash))
        self.end_headers()
        self.ws_state = "open"
        try:
            os.chdir(self.fspath)
            cmdlist = self.urlquery.get('cmd[]', None)
            if not cmdlist:
                raise Exception("No command")
            p = subprocess.Popen(cmdlist, stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception, e:
            if hasattr(e, 'errno'):
                retcode = e.errno 
                errstr = e.strerror
            else:
                retcode = 1
                errstr = str(e)
            self.ws_send_chunk(errstr, 2)
            self.ws_send_chunk('', 1, eof=True, retcode=retcode)
            self.ws_close(1000)
            self.do_shutdown()
            return

        try:
            self.ws_chat(p)
        except WException, e:
            print "WEXCEPT %s" % e.code
            traceback.print_exc()
            self.ws_close(e.code)
        except Exception, e:
            print "EXCEPT1", str(e)
            traceback.print_exc()
            self.ws_close(1011)
        self.do_shutdown()

    def ws_chat(self, p):

        def endgame():
            p.stdout.close()
            p.stdin.close()
            p.stderr.close()
            p.wait()
            if len(errbuf):
                self.ws_send_chunk(errbuf, 2)
            self.ws_send_chunk(outbuf, 1, eof=True, retcode=p.returncode)
            self.ws_close(1000)

        # cmd = self.pquery.get('cmd[]')[0]
        self.ws_buffer = ''    # Raw input from client
        eof_in = False         # EOF sent from client
        inbuf = ''             # Unmasked data to be dribbled to the process
        outbuf = ''            # Staging stdout to client
        errbuf = ''            # Staging stderr to client
        while 1:
            wfiles = []
            if len(inbuf) and not p.stdin.closed:
                wfiles.append(p.stdin)
            if len(outbuf) or len(errbuf):
                wfiles.append(self.connection)
            efiles = [p.stdout, p.stderr, self.connection]
            if not p.stdin.closed:
                efiles.append(p.stdin)
            rlist, wlist, errlist = select.select([p.stdout, p.stderr,
                                                   self.connection], wfiles, efiles, SELECT_TIMEOUT)
            if errlist:
                p.terminate()
                return endgame()
            if rlist:
                for f in rlist:
                    if f is p.stdout:
                        data = os.read(p.stdout.fileno(), BUFLEN)
                        #print "R STDOUT", len(data), cmd
                        if len(data) == 0:
                            return endgame()
                        outbuf += data
                    elif f is p.stderr:
                        data = os.read(p.stderr.fileno(), BUFLEN)
                        if len(data):
                            #print "STDERR ", data
                            errbuf += data
                    elif f is self.connection:
                        data = self.connection.recv(BUFLEN)
                        #print "R CONNECTION", len(data), cmd
                        if len(data):
                            if eof_in:
                                raise Exception("No data expected after EOF")
                            self.ws_buffer += data
                        else:
                            raise
                    else:
                        #print "R UNKNOWN", cmd
                        raise WException(1011)
            if wlist:
                for f in wlist:
                    if f is p.stdin:
                        l = min(select.PIPE_BUF, max(select.PIPE_BUF,
                                                     len(inbuf)))
                        #print "W STDIN", l, cmd
                        if l:
                            written = os.write(p.stdin.fileno(), inbuf[0:l])
                            inbuf = inbuf[written:]
                    elif f is self.connection:
                        #print "W CONNECTION", cmd
                        if len(errbuf):
                            self.ws_send_chunk(errbuf, 2)
                            errbuf = ''
                        if len(outbuf):
                            self.ws_send_chunk(outbuf, 1)
                            outbuf = ''
                    else:
                        #print "W UNKNOWN", cmd
                        raise WException(1011)
            while 1:
                meta, data = self.ws_get_chunk()
                if not meta:
                    break
                if meta["fd"] != 0: # only stdin supported now
                    #print "TERMINATE", cmd
                    p.terminate()
                    return endgame()
                if meta.get("eof", None):
                    eof_in = True
                inbuf += data
            if len(inbuf) == 0 and eof_in and not p.stdin.closed:
                #print "GOT EOF_IN", cmd
                p.stdin.close()

    def ws_send_chunk(self, buf, fd, eof=False, retcode=None):
        meta = {"pwsver": "1.0", "enc": "base64", "fd": fd}
        if eof:
            meta["eof"] = True
        if retcode:
            meta["retcode"] = retcode
        meta = json.dumps(meta)
        if len(meta) > 128:
            raise Exception("Header too large")
        padding = " " * (128 - len(meta))
        header = meta + padding
        payload = header + base64.b64encode(buf)
        self.ws_send_frame(payload)

    def ws_send_frame(self, payload, opcode=0x1):
        data = chr(0x80 | opcode)
        l = len(payload)
        if l < 126:
            data += chr(l)
        elif l < 65536:
            data += chr(126)
            data += struct.pack("!H", l)
        else:
            data += chr(127)
            data += struct.pack("!Q", l)
        data += payload
        self.connection.sendall(data)

    def ws_close(self, code):
        #print "WS CLOSE in ", self.ws_state
        if self.ws_state == "gotclose":
            self.ws_send_frame('', opcode=0x8)
            self.connection.close()
            self.ws_state = "closed"
        elif self.ws_state != "sentclose":
            self.ws_send_frame('', opcode=0x8)
            self.ws_state = "sentclose"
        else:
            self.connection.close()
            self.ws_state = "closed"

    def ws_get_chunk(self):
        """
        Strip our JSON header from the WS frame, decode base64 if required
        """

        chunk = self.ws_decode_frame()
        if len(chunk) < 128:
            return None, None
        try:
            metachunk = chunk[0:128].strip()
            meta = json.loads(metachunk)
            if meta["pwsver"] != "1.0" or meta["enc"] != "base64" or meta["fd"] != 0:
                raise
            data = chunk[128:]
            if len(data):
                data = base64.b64decode(data)
            else:
                data = '' # avoid mysterious invisible man in unicode
        except:
            traceback.print_exc()
            raise WException(1002)
        return meta, data

    def ws_decode_frame(self):
        """
        Decodes Websocket frame as per RFC 6455
        """

        buf = self.ws_buffer
        if len(buf) < 14:
            return ''
        start = 2
        opcode = ord(buf[0]) & 0xf

        if opcode == 0x8: # close frame
            if self.ws_state == "open":
                self.ws_state = "gotclose"
            raise WException(1000)

        length = ord(buf[1]) & 0x7f
        if length == 126:
            length, = struct.unpack("!H", buf[2:4])
            start += 2
        elif length == 127:
            length, = struct.unpack("!Q", buf[2:10])
            start += 8

        mask = [ord(b) for b in buf[start:start + 4]]
        start += 4

        if len(buf) < start + length:
            return ''

        payload = buf[start:start + length]
        self.ws_buffer = buf[start + length:]

        clear = ''
        for i in range(len(payload)):
            clear += chr(mask[i % 4] ^ ord(payload[i]))

        if opcode == 0x1:
            clear = clear.decode("UTF8")
        return clear

    def do_proxy(self):
        if not psty_options['enable_proxy']:
            return self.send_error(403, "Proxy not enabled")
        urlcomps = urlparse.urlsplit(self.path[1:])
        host = urlcomps.hostname
        port = urlcomps.port
        klass = HTTPSConnection if urlcomps.scheme == 'https' else HTTPConnection
        headers = self.headers.headers
        headers = [h for h in headers if not re.match(r'^(connection:|origin:|host:)', h.lower())]
        headers.insert(0, "Connection: close\r\n")
        headers.insert(0, "Host: %s\r\n" % urlcomps.netloc)
        #if cookie jar has cookies for this domain, add them to header
        if psty_options["enable_cookies"]:
            cookie = cookiejar.get_cookie(self.path[1:])
            if cookie:
                headers.insert(0, cookie)
        target = klass(host, port)
        target.connect()
        outbuf = []
        path = urlparse.urlunsplit(('', '', urlcomps.path, urlcomps.query, '')) or '/'
        outbuf.append("%s %s %s\r\n" % (self.command, path, self.request_version))
        for h in headers:
            outbuf.append(h)
        outbuf.append("\r\n")
        target.send("".join(outbuf))

        time_out_max = 100
        client_sock = self.connection
        server_sock = target.sock
        server_fp = server_sock.makefile('rb', 0)
        socks = [client_sock, server_sock]
        count = 0
        byte_length = 0

        RESP_READSTATUS = 1
        RESP_READHEADERS100 = 2
        RESP_READHEADERS = 3
        RESP_READBODY = 4
        self._pstate = RESP_READSTATUS
        self._pstatus = 0

        while 1:
            count += 1
            (recv, _, error) = select.select(socks, [], socks, 3)
            if error:
                break
            if recv:
                for sock in recv:
                    if sock is client_sock:
                        out = server_sock
                        data = client_sock.recv(BUFLEN)
                        if data == '':
                            socks.remove(client_sock)
                            #return self.do_shutdown()
                    else:
                        out = client_sock
                        if self._pstate == RESP_READSTATUS:
                            data = server_fp.readline()
                            #print "Got from %s: %s" % (self.path[1:], data)
                            comps = data.split()
                            if comps[1] == "100":
                                self._pstate = RESP_READHEADERS100
                            else:
                                self._pstate = RESP_READHEADERS
                            self._pstatus = int(comps[1])
                        elif self._pstate == RESP_READHEADERS:
                            data = server_fp.readline()
                            #print "Got from %s: %s" % (self.path[1:], data)
                            if data.strip() == "":
                                data = PROXY_CORS_HEADER % (psty_options["cors_allow"], self.path[1:]) + "\r\n"
                                self._pstate = RESP_READBODY
                            else:
                                data = self.proxy_transform_header(data)
                        elif self._pstate == RESP_READHEADERS100:
                            data = server_fp.readline()
                            if data.strip() == "":
                                self._pstate = RESP_READSTATUS
                        else:
                            data = server_sock.recv(BUFLEN)
                            if data:
                                byte_length += len(data)
                        if data == '':
                            self.log_message('"Proxy %s %s" %s %s',
                                             self.command, self.path[1:], str(self._pstatus),
                                             str(byte_length))
                            socks.remove(server_sock)
                            return self.do_shutdown()
                    if data:
                        out.sendall(data)
                        count = 0
            if count == time_out_max:
                break


class PstyServer(SocketServer.ForkingTCPServer):
    allow_reuse_address = 1


def readable(sf):
    return stat.S_IMODE(sf.st_mode) & stat.S_IRUSR != 0


def writable(sf):
    return stat.S_IMODE(sf.st_mode) & stat.S_IWUSR != 0


def _quote_html(html):
    return html.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

class FakeMessage:
    def __init__(self, header):
        self._header = [header]

    def getheaders(self, name):
        if name == 'Set-Cookie':
            return self._header
        return []


class FakeResponse:
    def __init__(self, header):
        self._message = FakeMessage(header)

    def info(self):
        return self._message


class SQLiteCookieJar(CookieJar):
    """CookieJar that can be loaded from and saved to a SQLite DB."""

    def __init__(self, filename=None, policy=None):
        """
        Cookies are NOT loaded from the named file until either the .load() or
        .revert() method is called.

        """
        CookieJar.__init__(self, policy)
        #Chrome on Mac OS X
        self.CHROMEMACDB = os.path.expanduser('~') + '/Library/Application Support/Google/Chrome/Default/Cookies'
        self.GET_QUERY_CHROME = 'select host_key as domain,name,value,path,expires_utc as expires,secure from cookies'
        #TODO Add Firefox and Linux/Windows support
        self.PSTYDB = os.path.expanduser('~') + '/.pstydb'
        self.GET_QUERY_PSTY = 'select * from cookies'
        self.GET_QUERY = self.GET_QUERY_PSTY
        #All writes are in PSTYDB format, not Chrome or Firefox
        self.SET_QUERY = 'insert into cookies (domain,name,value,path,expires,secure) values (?,?,?,?,?,?)'
        self.TRUNCATE_QUERY = 'delete from cookies'
        self.CREATE_SCHEMA = 'CREATE TABLE cookies (' \
                             'domain TEXT NOT NULL,' \
                             'name TEXT NOT NULL,' \
                             'value TEXT NOT NULL,' \
                             'path TEXT NOT NULL,' \
                             'expires INTEGER NOT NULL,' \
                             'secure INTEGER NOT NULL' \
                             ')'
        if filename is not None:
            try:
                filename + ""
            except:
                raise ValueError("filename must be string-like")
        else:
            if os.path.isfile(self.PSTYDB):
                filename = self.PSTYDB
                self.GET_QUERY = self.GET_QUERY_PSTY
            else:
                if os.path.isfile(self.CHROMEMACDB):
                    filename = self.CHROMEMACDB
                    self.GET_QUERY = self.GET_QUERY_CHROME

        self.filename = filename

    def save(self, filename=None):
        """Save cookies to DB."""
        create_schema = False
        if filename is None:
            filename = self.PSTYDB
        if not os.path.isfile(self.PSTYDB):
            create_schema = True
        conn = sqlite3.connect(filename)
        try:
            cursor = conn.cursor()
            if create_schema:
                cursor.execute(self.CREATE_SCHEMA)
            cursor.execute(self.TRUNCATE_QUERY)
            cursor.executemany(self.SET_QUERY, self._cookies_as_tuples())
            conn.commit()
        finally:
            conn.close()

    def load(self, filename=None):
        """Load cookies from DB."""
        if filename is None:
            if self.filename is not None:
                filename = self.filename
            else:
                raise ValueError('File name missing')

        conn = sqlite3.connect(filename)
        try:
            cursor = conn.cursor()
            cursor.execute(self.GET_QUERY)
            for cookie in self._cookies_from_cursor(cursor):
                self.set_cookie(cookie)
        finally:
            conn.close()

    def store_cookie(self, header, path):
        header = re.sub(r'[^:].*: ', u'', header)
        if len(self._cookies) == 0:
            self.load()
        self.extract_cookies(FakeResponse(header), Request(path))
        self.save()

    def get_cookie(self, path):
        request = Request(path)
        if len(self._cookies) == 0:
            self.load()
        self.add_cookie_header(request)
        if request.get_header('Cookie'):
            return "Cookie: %s\r\n" % request.get_header('Cookie')
        return None

    def _cookies_from_cursor(self, cursor):
        cookies = []
        for row in cursor:
            domain = row[0]
            name = row[1]
            value = row[2]
            path = row[3]
            expires = row[4]
            secure = row[5]
            cookies.append(Cookie(None, name, value, None, None, domain, True, bool(domain.startswith(".")),
                                  path, True, secure, expires, False, None, None, None))
        return cookies

    def _cookies_as_tuples(self):
        tuples = []
        for domain in self._cookies:
            for path in self._cookies[domain]:
                for cookiekey in self._cookies[domain][path]:
                    cookie = self._cookies[domain][path][cookiekey]
                    tuples.append(
                        (cookie.domain, cookie.name, cookie.value, cookie.path, cookie.expires if cookie.expires else 0,
                         cookie.secure))
        return tuples


cookiejar = SQLiteCookieJar()


def usage():
    u = """
Usage: %s (-a|-pwfc) [-d <dir>] [<port>]
       %s -h

Options:
    -h          print usage
    -p          enable web proxy
    -f          enable file server
    -w          enable websocket shell
    -c          enable cookies
    -a          enable all services
    -d <dir>    export <dir> via file server (default: current directory)
    <port>      server port (default: 50937)
"""
    print u.strip() % (sys.argv[0], sys.argv[0])
    sys.exit(1)


if __name__ == '__main__':
    port = 50937
    try:
        opts, args = getopt.getopt(sys.argv[1:], 'apwfd:c')
        for o, a in opts:
            if o == '-h':
                usage()
            elif o in ('-p', '-w', '-f', '-c', '-a'):
                opt_map = {'-p': ['enable_proxy'], '-w': ['enable_wsh'],
                           '-f': ['enable_fileserver'], '-c': ['enable_cookies'],
                           '-a': ['enable_proxy', 'enable_wsh', 'enable_fileserver']}
                for m in opt_map[o]:
                    psty_options[m] = True
            elif o == '-d':
                if os.path.isdir(a):
                    psty_options['export_path'] = a
                else:
                    raise Exception("Directory %s not found" % a)
        if len(args) > 1:
            usage()
        if len(args) == 1:
            port = int(args[0])
    except Exception, e:
        print str(e)
        usage()

    if not (psty_options['enable_proxy'] or psty_options['enable_wsh'] or
        psty_options['enable_fileserver']):
        print "At least one of proxy, wsh, fileserver must be anabled"
        usage()

    # DO NOT CHANGE localhost! Psty is a completely open proxy and should
    # not be exposed on the LAN, let alone the Internet.
    server_address = ('localhost', port)

    PstyRequestHandler.protocol_version = "HTTP/1.1"
    PstyRequestHandler.proxy_address = server_address
    httpd = PstyServer(server_address, PstyRequestHandler)

    sa = httpd.socket.getsockname()
    services = ", ".join([k[7:] for (k, v) in psty_options.items() if k.startswith('enable') and v])
    print "Serving", services, "on", sa[0], "port", sa[1], "..."
    httpd.serve_forever()

/*
 * Copyright (C) 2012-2015 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * Barebones S3 implementation
 *
 * AWS is awkward.
 *
 * First, you need to sign into "Login With Amazon". Then you need to
 * create an IAM policy allowing this user access to S3 resources. (We need
 * to write a boto script for this). Finally, you may want to enable CORS on
 * your buckets.
 *
 * mount -t s3 -o user=foo@bar.com,arn=<your_aws_role_arn> /mnt
 *
 */

var S3FS = function(opts, uri) {
    S3FS.base.call(this, opts, uri);
    this.auth_handler = VFS.lookup_auth_handler("amazon").handler;
    assert("S3FS.1", this.auth_handler && this.opts.arn && this.opts.user);
};

inherit(S3FS, HttpFS);

S3FS.defaults = {
    tx: "proxy"
};

S3FS.scripts = ["extra/aws-sdk.js"];

S3FS.lookup_uri = loadscripts(HttpFS.lookup_uri);

S3FS.rooturi = function(opts) {
    return "s3://";
};

var S3File = function() {
    S3File.base.apply(this, arguments);
    this.mime = 'application/vnd.pigshell.s3file';
};

inherit(S3File, HttpFile);

S3FS.fileclass = S3File;

function s3init(next) {
    return function() {
        var self = this,
            args = [].slice.call(arguments);

        if (!self.fs.s3) {
            var authinfo = self.fs.auth_handler.get_auth(self.fs.opts.user),
                access_token = authinfo.access_token,
                user_id = authinfo.userinfo.user_id;
            assert("s3init.1", access_token, access_token);
            var creds = new AWS.WebIdentityCredentials({
                RoleArn: self.fs.opts.arn,
                ProviderId: "www.amazon.com",
                WebIdentityToken: dec_uri(access_token)
            });

            AWS.config.update({httpOptions: {proxy: VFS.lookup_tx("proxy").uri}});
            self.fs.s3 = new AWS.S3({
                region: self.fs.opts.region,
                credentials:  creds,
                maxRetries: 1
            });
        }
        return next.apply(self, args);
    };
}

/*
 * This is one of the rare filesystems which use an external library to
 * make HTTP calls. We need to track abortable calls, like HttpTX, so killing
 * commands will abort (potentially large) network requests in progress.
 */

function s3wrap(method, context) {
    var self = this,
        args = [].slice.call(arguments, 2),
        cb = args.pop();

    args.push(function(err, res) {
        if (context && context._abortable) {
            var index = context._abortable.indexOf(req);
            if (index !== -1) {
                context._abortable.splice(index, 1);
            }
        }
        return cb(err, res);
    });
    var req = method.apply(null, args);
            
    if (context && context._abortable) {
        context._abortable.push(req);
    }
}

S3File.prototype.getmeta = s3init(function(opts, cb) {
    var self = this,
        u = URI.parse(self.ident),
        bucket = u.host(),
        path = u.path();

    if (self.ident === "s3://") {
        return cb(null, {name: "/", mime: "application/vnd.pigshell.s3root"});
    } else if (path === "") {
        /* Bucket. Not tested XXX */
        var method = self.fs.s3.headBucket;
        s3wrap(method.bind(self.fs.s3), opts.context, {Bucket: bucket},
            ef(cb, function(data) {
            return cb(null, {name: bucket, ident: "s3://" + bucket, mime: "application/vnd.pigshell.s3bucket"});
        }));
    } else {
        /* Object. Not tested XXX */
        var method = self.fs.s3.headObject;
        s3wrap(method.bind(self.fs.s3), opts.context, {Bucket: bucket,
            Key: path}, ef(cb, function(data) {
            var meta = {
                name: path,
                ident: self.ident,
                mime: "application/vnd.pigshell.s3object",
                mtime: Date.parse(data.LastModified),
                size: data.ContentLength
            };
            return cb(null, meta);
        }));
    }

});

S3File.prototype.read = function(opts, cb) {
    var self = this,
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime) {
        return cb(E('ENOSYS'));
    }

    if (mime === "application/vnd.pigshell.s3root") {
        var method = self.fs.s3.listBuckets;
        s3wrap(method.bind(self.fs.s3), opts.context, ef(cb, function(data) {
            var owner = data.Owner ? data.Owner.DisplayName : "me",
                buckets = data.Buckets || [],
                files = buckets.map(function(b) {
                    return {
                        name: b.Name,
                        bucket: b.Name,
                        ident: "s3://" + b.Name,
                        mime: "application/vnd.pigshell.s3bucket",
                        ctime: Date.parse(b.CreationDate),
                        raw: data
                    };
                });
            return cb(null, {files: files});
        }));
    } else if (mime === "application/vnd.pigshell.s3bucket") {
        var params = {Bucket: self.bucket, EncodingType: "url"};
        s3wrap(self.fs.s3.listObjects.bind(self.fs.s3), opts.context,
            params, ef(cb, function(data) {
                return cb(null, {files: data.Contents.map(obj2meta.bind(data))});
        }));
    } else {
        var params = {Bucket: self.bucket, Key: dec_uri(self.name)};
        s3wrap(self.fs.s3.getObject.bind(self.fs.s3), opts.context,
            params, ef(cb, function(data) {
            to("blob", data.Body,
                {mime: data.ContentType || "application/octet-stream"}, cb);
        }));
    }

    function obj2meta(o) {
        var meta = {
            raw: o,
            bucket: this.Name,
            name: o.Key,
            mtime: Date.parse(o.LastModified),
            size: o.Size,
            owner: o.Owner.DisplayName,
            mime: "application/octet-stream",
            ident: "s3://" + this.Name + "/" + o.Key
        };
        return meta;
    }
};

S3File.prototype.putdir = mkblob(function(filename, blob, opts, cb) {
    var self = this,
        params = {Bucket: self.bucket, Key: filename, Body: blob},
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null;

    if (!mime || mime !== "application/vnd.pigshell.s3bucket") {
        return cb(E('ENOSYS'));
    }

    s3wrap(self.fs.s3.putObject.bind(self.fs.s3), opts.context,
        params, ef(cb, function(data) {
            return cb(null, null);
    }));
});


S3File.prototype.rm = function(file, opts, cb) {
    var self = this,
        ufile = self._ufile,
        mime = ufile ? ufile.mime : null,
        params = {Bucket: self.bucket, Key: file.name};

    if (!mime || mime !== "application/vnd.pigshell.s3bucket") {
        return cb(E('ENOSYS'));
    }
    s3wrap(self.fs.s3.deleteObject.bind(self.fs.s3), opts.context,
        params, ef(cb, function() {
            return cb(null, null);
    }));
};

VFS.register_media_handler("application/vnd.pigshell.s3root", "Dir", {cache_time: 5 * 60 * 1000});
VFS.register_media_handler("application/vnd.pigshell.s3bucket", "Dir", {cache_time: 5 * 60 * 1000});
VFS.register_handler("s3", S3FS);
VFS.register_uri_handler("s3://", "s3", {});
URI.register_uri_parser("s3", HttpURI);

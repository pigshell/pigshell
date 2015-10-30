/*
 * Copyright (C) 2012-2015 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

var Env = {
    production: {
        auth: {
            google: {
                client_id: "1062433776402.apps.googleusercontent.com",
                scope: [ "https://www.googleapis.com/auth/userinfo.profile",
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/drive",
                    "https://picasaweb.google.com/data/" ].join(" "),
                redirect_uri: pigshell.site.url + "/common/oauth2_redirect.html"
            },
            dropbox: {
                client_id: "ctc1idg9mu021c5",
                redirect_uri: "https://" + pigshell.site.name + "common/oauth2_redirect_https.html"
            }
        }
    },
    dev: {
        auth: {
            google: {
                client_id: "1062433776402.apps.googleusercontent.com",
                scope: [ "https://www.googleapis.com/auth/userinfo.profile",
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/drive",
                    "https://picasaweb.google.com/data/" ].join(" "),
                redirect_uri: pigshell.site.url + "/common/oauth2_redirect.html"
            },
            dropbox: {
                client_id: "ctc1idg9mu021c5",
                redirect_uri: "https://" + pigshell.site.name + "common/oauth2_redirect_https.html"
            }
        }
    }
};

Sys.env = Env;

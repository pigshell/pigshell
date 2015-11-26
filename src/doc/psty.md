Psty
====

[Psty](../../psty.py) is a little server you run on your desktop as a sidekick
to [Pigshell](http://pigshell.com). While _pigshell_ can be used standalone,
_psty_ (the p is silent, as in Psmith) adds so much to its power and reach as
to be practically indispensable.

_Psty_ implements three services:

1.  **Local file server:** _Psty_ exposes a local directory of your choice to
    _pigshell_, letting you read and write files stored on your desktop from
    _pigshell_.
2.  **HTTP proxy server:** _Psty_ proxies HTTP requests for _pigshell_, giving
    it access to any URL on the web, bypassing the same-origin restrictions
    faced by Javascript apps in the browser.
3.  **Websocket server:** Every unix app on the desktop which uses stdin/stdout
    can participate in a _pigshell_ pipeline.

Together, these features enable powerful data movement and transformation
pipelines. For instance:

    pig> cat http://pigshell.com/sample/oslogos.png | wsh convert -implode 1 - - | to -g canvas

![Implode](../../images/screenshots/implode.jpg)

We grabbed an image from pigshell.com using the proxy, piped it via websocket
to the local Unix host running _psty_, ran the ImageMagick convert tool to
transform the image (taking care to use stdin/stdout), piped it back to
_pigshell_ and displayed the transformed image.

_Psty_ is implemented as a single standalone Python file weighing < 1000
lines, and requires only a standard Python 2.7 distribution. It can run on
Linux and Mac OS. _Psty_ is reported to partially work (local file and proxy
services) on Windows under Cygwin.

Installation
------------

<a href="../../psty.py" download="psty.py">Download _psty_</a> and run it from a shell as follows:

        bash$ python psty.py -a -d /some/scratch/directory

This command starts all three services and exposes /some/scratch/directory to
all _pigshell_ instances running in your browser. There are CLI options to
start a subset of the services, and to change the default port of 50937.

In your _pigshell_ tab, type the command

        pig> mount http://localhost:50937/ /home

and you should be able to see the contents of /some/scratch/directory inside
/home.

This mount command needs to be typed every time you start or reload the page.
To do it automatically, 

        pig> echo "HOME=/home\nmount http://localhost:50937/ $HOME" >/local/rc.sh

/local/rc.sh is a script stored in the browser's LocalStorage and will be
invoked every time http://pigshell.com is (re)loaded.

Currently, _pigshell_ assumes that websocket and proxy services are available
at localhost:50937. This will be configurable in future.

Examples
--------

1.  Data movement: Back up all Picasa photos to a local directory

        pig> mkdir /home/taj; cp /picasa/albums/TajMahal/* /home/taj

2.  Data retrieval: Copy a file from the web, continuing from where we left off

        pig> cp -c http://ftp.freebsd.org/pub/FreeBSD/ISO-IMAGES-amd64/10.0/FreeBSD-10.0-RC4-amd64-bootonly.iso /home

3.  Running commands on the desktop:

        pig> wsh ps ax

    runs `ps` on your desktop and dumps the output in _pigshell_.

4.  Running pipelines on the desktop:

        pig> wsh sh -c 'ls | grep foo'

    runs a Bourne shell on the desktop with the given pipeline. Note that
    `wsh 'ls | grep foo'` won't work.

4.  Visualization: Local disk usage visualized in an interactive zoomable
    treemap

        pig> wsh du /Users/foo | to -g text | iframe /templates/d3-du-treemap

![du-treemap](../../images/screenshots/du-treemap.png)

    (Note that `du` of a deep tree may take a while, try with a shallow
    directory tree first)

Why Psty
--------

_Pigshell_ wants to be a common platform where web and local data can copied,
mixed, viewed, analyzed and visualized using the browser's display engine.
There are several issues holding it back from this goal:

1.  **CORS:** For security reasons, Ajax calls from Javascript are restricted by
    the common origin policy from retrieving data from random websites, since
    that would enable evil.com's scripts to trawl through LAN websites which
    were really not meant to be publicly visible.

    However, this same policy also prevents Javascript from accessing
    different-origin websites like Wikipedia, which are *meant* to be publicly
    visible. The official solution to this is
    [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing),
    where public websites add a header to their responses, indicating that
    cross-origin access is OK.

    Unfortunately, CORS support in the wild is practically non-existent. The
    Wikipedia article on CORS does not have a CORS header. Even those sites
    which claim to support CORS often have half-hearted support (GET but not
    HEAD). Picasa APIs work cross-origin as long as you're doing GETs, but
    don't work with POSTs, since they don't implement OPTIONS properly.

    So you have no choice but to use a proxy to access public URLs from
    Javascript.

2.  **Local filesystem access:** Getting access to the local filesystem from
    the browser is an awkward and messy affair. Dumping large objects to the
    desktop from Javascript has always been a challenge because there is no
    way to "stream" it. The File API is still very much a work in progress.

    Accessing the local filesystem via an HTTP server gives us many benefits:
    streaming reads and writes, the ability to move data back and forth from
    the cloud to the desktop, and an unlimited workspace.

3.  **Utilities:** Tons of apps are coming to Javascript every day, many of them
    via the Emscripten route, but there are still a wealth of tools available
    on the average Unix workstation - ImageMagick, R, even plain old grep -
    for which exact equivalents are hard to find.

While some of these requirements can be met by a cloud backend, we strongly
prefer pure client-side, self-scaling architectures (basically we don't want the
headache of maintaining a server) _Psty_ lets us do all these things while
still being easy to deploy and use.
    
HTTPS
-----

If _pigshell_ is being served from an https domain, then we need to run
_psty_ in https mode as well, otherwise browsers complain bitterly about
mixed content. First generate a self-signed certificate for localhost:

    bash$ openssl req -new -x509 -keyout localhost.pem -out localhost.pem -days 365 -nodes -subj /CN=localhost

Now run psty as follows:

    bash$ python psty.py -a -d /tmp/scratch -s localhost.pem

You may want to visit https://localhost:50937/ once directly from the browser
and click until it accepts the self-signed certificate and stores a permanent
exception.

Security
--------

_Psty_ serves data only to localhost, and then only when it sees an origin
header from http://pigshell.com. 

Any modification of _psty_ can be dangerous. Specifically,

1.  Changing the CORS headers to '\*' should never be done. This allows any
    site you visit from your desktop to use _psty_. If you want to run a 
    copy of _pigshell_ from another domain, change the headers to that
    domain name and not '\*'.
2.  Don't changing the listening IP from localhost. You don't want your data
    to be exposed even on the LAN.

As _pigshell_ is open source, you can verify that the code does what it is
supposed to do. Running _pigshell_ scripts from untrusted sources is as
dangerous as running untrusted shell scripts on your desktop. 

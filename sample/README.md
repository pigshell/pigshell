Pigshell
========

Interact with your cloud data, Unix style.

Your data on Google drive, Picasa albums, Facebook and Twitter are represented
as files in a hierarchical file system. You can construct pipelines of simple
commands to filter, transform and display your data.

A quick way to try out _Pigshell_:  Connect your Facebook account, type
`fbstats` at the prompt and hit Enter.

Simple Examples
---------------

1.  First, connect your Facebook account. *(Data privacy is assured:
    _Pigshell_ is a pure Javascript app, no access tokens or user data are
    visible to or stored by the server.)*
    
    Then,
    
        pig> cd /facebook/friends
        pig> ls
    
    will give you a list of your friends with thumbnails. Commands issued on
    the CLI are asynchronous, so each command will fill its output area as
    and when it gets data. The `pig>` prompt may glow green to indicate that a
    command or pipeline is running.

2.  **Where in the world are my friends?**

        pig> map /facebook/friends/*

    `map` is a command which examines each file for a location attribute. In
    case one is present, it will be plotted on a map. Another way of doing
    this would be

        pig> ls /facebook/friends/ | map

    _Pigshell_ passes objects over pipes. In this case, `ls` emits a stream of
    *file* objects, which are consumed by map.

    Let's refine the above query: **Where are all my male friends?**

        pig> ls /facebook/friends | grep -f gender "^male" | map

    `grep` is a generic filter command, which may filter either by an object's text representation, or a specific field - in this case, gender.

3.  **Facebook statistics**

    **How many friends do I have?**

        pig> ls /facebook/friends | sum

    **Pie chart of relationship status of all female friends:**

        pig> ls /facebook/friends | grep -f gender "female" | chart -f relationship_status

Frequently Asked Questions
==========================

Basic Usage
-----------

1.  **What about the privacy of my data?**

    **Your data stays 100% private.** The app is all static files and
    runs completely as client-side Javascript. The server cannot see any
    data or access tokens.

2.  **I typed a command, and it immediately came back to the prompt, and the
    old prompt is pulsing green! What's happening?**

    Interactive commands are asynchronous, because fetching stuff from the
    network takes time. The command will display output when it's done.
    Meanwhile, you can start on your next command.

    A pulsing green prompt is displayed next to a pipeline which is running.
    When it completes, the prompt will go black, or red if its "exit"ed with a
    non-true exit status.

3.  **How do I see a list of running commands?**

    `ps` will show you a list of running pipelines. Pipelines are the unit
    of process management in _pigshell_.

4.  **How do I kill a command? It's been glowing green forever!**

    Use `ps` to find its PID and `kill`. You can also `stop` and `start`
    pipelines, which is roughly the equivalient of `kill -STOP` and
    `kill -CONT`. Stopped commands will have their prompt turn amber.

5.  **Why does `ls | cat` in _pigshell_ behave like `ls | xargs cat` in Unix?**

    _Pigshell_ passes objects (rather than opaque data) over the pipe. `ls`
    in its normal incarnation emits *file* objects. `cat` (and other filter
    commands) receiving file objects will process them not as text, but as
    files. You can think of it as an implicit `xargs`.

    `ls -l` emits text strings, so `ls -l | cat` will behave the same on
    both _pigshell_ and a Unix shell. While initially confusing, this
    is the more natural behaviour in a web environment thickly populated with
    structured objects. See the [User guide](pigshell.html) for more details.
    
6.  **I can't see the cursor.**

    Long-running or CPU-intensive commands may sometimes freeze the page for
    a few seconds. It is also possible that keyboard focus has gone elsewhere.
    Click on the last prompt and focus should return there.
 
7.  **There are two cursors on the screen. What do I do now?**

    You probably ran a command which is reading something from standard
    input, and it has opened up a little line just below its command line
    with a cursor. You may click on that line to move focus there and
    enter input. You can use **Ctrl-D** at the beginning of a new line
    to signal end of input.

    If it was a mistake, then you can simply click on the latest prompt
    and continue issuing new commands. You can ignore or kill the old
    command.

8.  **How do I reboot?**

    Reload the page. Hold down Shift while reloading may help, clearing your
    browser cache.

9.  **What commands are available?**

    Most commands are built-in, while a few are scripts found in `/bin`.
    You can see a list of commands using the `help` command. Help for a
    specific command like `ls` may be seen either using `ls -h` or `help ls`.

10. **What browsers are supported?**

    _Pigshell_ should work on most modern browsers. We use Chrome on MacOS
    as our primary dev/test platform, but Firefox, Safari on MacOS,
    Chrome and Firefox on Linux, and Chrome on Windows work as well.

    Firefox on Windows has known issues with stack overflows.

    Nothing on the iPad works currently due to keyboard input issues.

11. **Can I write my own scripts?**

    Of course, that's the whole idea. The syntax is close enough to bash, and
    looking through existing scripts in `/bin` should give you enough of an
    idea to start writing your own. A trip to the [User Guide](pigshell.html)
    is definitely recommended, though.

How do I..
-----------

1.  **How do I copy files to my desktop?**

    Copying  the files to /downloads will do the trick. Note that you cannot
    see anything inside the /downloads directory, it's just a pseudo-target
    to trigger a browser download. For example,

    `cp /picasa/albums/foo/DSC_1290.JPG /downloads`

2.  **How do I upload a photo from my desktop to Facebook, or Google Drive?**

    Click on _Upload Files_ and select a file or files from your desktop.
    These files are now visible under the directory `/uploads`. Use `ls`
    to verify that they're there. Now use `cp` to copy them to the
    target directory.

    `cp /uploads/cat.jpg /gdrive`  
    `cp /uploads/cat.jpg /facebook/me/albums/MyCat/`

3.  **How do I copy Picasa photos to Facebook?**

    `cp /picasa/albums/FooAlbum/photo1 /facebook/me/albums/BarAlbum/`

4.  **How do I create a new album on Facebook?**

    `mkdir /facebook/me/albums/Hawaii2012`

5.  **How do I tweet?**

    `echo "hello, world!" >/twitter/me/tweets/

6.  **How do I post to Facebook?**

    `echo "hello, world!" >/facebook/me/posts/

7.  **How do I write scripts?**

    The `edit` command implements a simple, minimal editor using
    [CodeMirror](http://codemirror.net).

8.  **How do I store scripts so that they survive a "reboot"?**

    The /local filesystem uses the browser's HTML5 localStorage as its
    backing store. Files stored there will survive a page reload (aka "reboot")
    Note that localStorage is typically limited to about 5 MB per site, so
    this is only suitable for saving small files like scripts.

9.  **How do I rename files?**

    Sorry, renaming files is not supported at the moment.

10. **How do I figure out what attributes a file object contains?**

    Use `stat <file>` or `printf -j <file>`. Most files have a `raw`
    attribute containing all the information returned by the backend
    API.

11. **How do I make sense of these errors? I get parse error for a line
    which is most certainly correct. Expected "#", "\n", "\r", "\r\n"? WTF?**

    Sorry. Error reporting is still in the "PC Load Letter" era. The line
    number indicates the _beginning_ of a block which failed to parse. So if you
    have a long multi-line `if` construct with an error somewhere in the
    middle, it will flag the `if` line as the source of the error.

    The best way right now is to comment out chunks of the block to figure out
    which one is causing the real trouble.

11. **What data sources are supported, and what operations work on those files?**

    *   **Facebook:** Creating new albums, reading (but not editing!) photos,
        writing new photos. Photos created with _Pigshell_ can be deleted.
        Reading of posts, writing of text posts.

    *   **Google Drive:** Reading, creating, deleting files.

    *   **Picasa: Reading and editing of photos. Creating and deleting
        photos is not supported.

    *   Twitter: Reading and posting tweets. Deletion is not supported.
        
    So you can copy a photo from Picasa to Facebook, but not vice-versa.
    Many of the above limitations are due to
    [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
    issues, and will hopefully go away in the future.

Philosophy
----------

1.  **What is unique about _pigshell_? How is this different from IFTTT/YQL/
    <insert-web-api>?**

    _Pigshell_ provides a Unix-like CLI environment to converse with your
    cloud data in an exploratory style, composing commands with simple
    commands and pipes to process files. It occupies the same evolutionary
    niche as the Unix shell and shell-scripting - everyday, casual programming.

    Services like IFTTT are about setting up data flows, like cron jobs.
    _Pigshell_ is about exploring, analyzing and processing data. Somewhat
    like YQL, but based around Unix/shell/file idioms rather than SQL.

2.  **What are the common use cases for _pigshell_?**

    1.  Quick and dirty personal and social analytics
    2.  Data movement across the cloud: e.g. copying photos from Picasa to
        Facebook and vice versa.
    3.  Write scripts to customize and personalize the experience of
        navigating the cloud.

Advanced Examples
-----------------

1.  **Top 10 liked photos in my albums**
        pig> cd /facebook/me/albums
        pig> ls -R | sort -rf likes | printf -H "<img src='%(thumbnail)s'/><p>Likes: %(likes)s</p>" | head

2.  Now let's take a photo from Picasa, convert it to grayscale and post it
    to Facebook. Make sure your Google and Facebook accounts are connected.

        pig> mkdir /facebook/me/albums/frompicasa
        pig> cat /picasa/albums/FooAlbum/foopic | pixastic -d >/facebook/me/albums/frompicasa/foopic

3.  **Mirror, mirror on the wall, who's the most social of 'em all?**

    Suppose you want to find out who's got the most followers or friends in
    your immediate circle, across Twitter and Facebook.

        pig> ls /facebook/friends /twitter/followers | fmap -s friend_count,followers -t xcount | sort -rf xcount | printf "%(name)-20s %(xcount)s" | head

    Here's what we did: first, we got a list of your FB friends and Twitter
    followers. Each file corresponding to an FB person has a `friend_count`
    attribute, and each Twitter person-file has a `followers` attribute. We map
    both these to a new attribute, `xcount`, and sort on that field. Finally,
    we print the people with the top 10 `xcount`s.

More
----
The [user guide](pigshell.html) has more detailed coverage of _pigshell_ concepts and the
scripting language.

Contact
-------
Email us at dev@pigshell.com or tweet @pigshell

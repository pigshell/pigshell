Google Drive on Pigshell
========================

_Pigshell_ lets you mount Google Drive as a filesystem and interact with its
contents using a Unix-like CLI - entirely within the browser. This approach has
several advantages which complement the web client and the Google Drive native
application.

-   Backup files and documents stored on Drive to your desktop with a simple
    one-liner like: `cp -r /gdrive/username@gmail.com /home/`
-   Attach Drives belonging to multiple users at the same time, including
    Google Apps for Business accounts. Transfer files between them with simple
    `cp` commands.
-   Explore, select and perform operations on multiple files using Unix-like
    pipelines. For example, "move all presentations older than a year to folder
    ppt-2013".
-   As an open source, pure client-side Javascript app, _pigshell_ is largely
    free of version ratchet, where apps and services force one-way "upgrades"
    and let you cope with the fallout. This guide was written for Pigshell
    0.5.2, which you can always access at
    [http://pigshell.com/v/0.5.2](http://pigshell.com/v/0.5.2) and host locally
    if needed. The instructions here will work as long as the Google Drive v2
    API is supported.

_Pigshell_ aims to provide a common minimum filesystem interface to various web
data sources; it will therefore (probably) never support Drive and Docs API
features like sharing, version control, etc.

## Getting Started ##

Go to [http://pigshell.com](http://pigshell.com), click on the Google icon
and the **Attach Google Account** popup. This will redirect you to Google's
authentication screen. Once authentication and authorization are completed, the
Google icon turns red.  Click again to add more Google accounts if needed.

Drive filesystems are automatically mounted at `/gdrive/username@gmail.com`
at every page reload.

Note that data flow is entirely between your browser and Google. The _pigshell_
server is a dumb static web server - it cannot see any authentication tokens or
user data.

To list the files in Drive,

    pig:/$ cd /gdrive/username@gmail.com
    pig:username@gmail.com$ ls

Clicking on any of the files takes you to the corresponding Google web page for
editing the document.

_(From now on, we omit the prompt to make it easy to cut and paste commands)_

To list all spreadsheets,

    ls | grep -f mime spreadsheet

Similarly,

    ls | grep -f mime presentation
    ls | grep -f mime document

lists all the presentations and documents in the root folder respectively.

The Google Drive UI encourages users to create a huge pile of documents in one
unmanageable root folder, thereby making the **Search** box a necessary first
step to find anything. For those used to managing hierarchical folders,
_pigshell_ offers a way to clean up the closet without a lot of dragging and
dropping.

    mkdir fy2013-14 # Make a folder
    ls | grep -f mime spreadsheet # Figure out what spreadsheets I have
    ls | grep -f mime spreadsheet | grep 2013 # Refine based on name
    ls | grep -f mime spreadsheet | grep 2013 | mv fy2013-14 # Move em all

Typical _pigshell_ pipelines consist of commands processing lists of objects.
In the above case, the first `grep` matches only objects whose `mime` attribute
contains the string "spreadsheet". The second matches those whose names contain
the string "2013". `mv` receives a bunch of matched file objects, which it then
moves into `fy2013-14`. This might equally well be accomplished by `mv
*2013*ppt fy2013-14`, but the pipe based approach allows for interactive,
incremental refining of the file selection.

    ls | grep -f mime spreadsheet | grep -e 'x.mtime < Date.parse("Jan 1, 2014") && x.mtime > Date.parse("Dec 31, 2012")' | mv fy2013-14

In this case, the second `grep` uses a Javascript expression to determine matching objects.

Removing files is also straightforward. Files are moved to trash rather than
obliterated. Trashed files can be recovered using the Drive web GUI.

    ls *2013*       # OK, that looks like the right bunch of files
    rm *2013*       # Nuke em
    ls *2013* | rm  # Alternative method

Files shared with you are visible under the "Shared With Me" folder.

    cd "Shared With Me"
    ls


## Documents and Files ##

There are important differences between **documents** and **files** in the
Google Drive context. Both are visible as file entities in Drive UIs as well as
_pigshell_, but they are treated differently when it comes to viewing, copying
and moving operations.

**Documents** should be considered as abstract resources controlled by Google
Docs. They do not have a specific size or a specific sequence of bytes as
visible to the external world via the Drive API. One can retrieve a
representation of this resource in a format like `docx`, `odt`, `pdf` or even
`txt`, but there is no guarantee that downloading and re-uploading a document
even in a canonical format (say, docx) is going to result in a byte-identical
result, since there is conversion going on both ways.

**Files** are images, text files and other data which are stored by Drive as-is.
A file has a specific size, contents and checksum as visible from the Drive API.
Downloading and re-uploading such a file gives predictable results.

While copying document files (docx/pptx/xlsx) from any source into Drive,
even those previously retrieved from Google Docs, you need to specify whether
you want Drive to treat them as _documents_ (effectively, converting them
internally to Google Docs resources), or as opaque _files_, in which case they
will be stored as-is. In the former case, you will be able to edit them with
Google Docs, but in the latter case, they will appear as zip files, since docx
et al use zip as a container format.

Note that conversion semantics [have changed](#14042015).

By default, _pigshell_ satisfies a `read()` on a document by retrieving its
representation in the appropriate OOXML format (docx/pptx/xlsx) and a `read()`
on a file with its binary contents. When copying a file into Drive, _pigshell_
defaults to storing it as a binary file, even if it was originally a document.
These defaults can be overridden by CLI options as explained below.

## Viewing Documents and Files ##

You cannot view documents directly in _pigshell_, but you can view a PDF
representation of their contents. To view them as Office files, you can
copy them to your desktop and open them using your preferred Office application.

    cat -o gdrive.fmt=pdf Resume
    cat -o gdrive.fmt=pdf Trip\ Expenses
    cat -o gdrive.fmt=txt Resume            # Text representation

Files for which _pigshell_ has media handlers can be viewed directly.

    cat bird.jpg

Files for which _pigshell_ cannot determine mime type, or lacks a media
handler, will be displayed as text. Unlike Unix terminals, the process of
spewing binary garbage onto the screen is mercifully silent.

## Copying From Drive ##

Copying a single document is easy:

    cp Resume /tmp # Copies as docx
    cp -o gdrive.fmt=pdf Resume /tmp/R.pdf # Copies as pdf
    cp -o gdrive.fmt=txt Resume /tmp/R.txt # Plain text

To view the PDF version, 

    cat /tmp/R.pdf

This is nice, but `/tmp` is backed by a RamFS; reload the page and it's gone.
To copy a file to the desktop,

    cp /gdrive/username@gmail.com/Resume /downloads

The file will hit the default downloads directory of your browser.

For dealing with files in bulk, it is much more convenient to
[download](../../psty.py) and run [psty](psty.md), which exports a designated
directory on the desktop to _pigshell_ using a simple filesharing protocol over
HTTP.

    python psty.py -a -d /some/dir # Run in DESKTOP SHELL (bash), not pigshell

The _psty_ server runs only on Linux and Mac OS at present.

    mount http://localhost:50937/ /home # Run in PIGSHELL, not desktop shell

`/some/dir` on your desktop is now visible to _pigshell_ at `/home`. Anything
you copy from _pigshell_ into `/home` can be accessed from your desktop at
`/some/dir` and vice versa.

## Backup ##

Once you've got psty running and /home mounted, you can take a full backup of
your Drive as follows:

    mkdir /home/drivebackup
    cp -rv -X /Trash /gdrive/username@gmail.com /home/drivebackup

This will take a while. Copies can be continued or refreshed with

    cp -crv -X /Trash /gdrive/username@gmail.com /home/drivebackup

The `-c` flag will skip files which have the same size on both locations.  In
case the size of the source is zero (documents on Drive are 0-sized), it will
skip source files which have an older modification time than the target.
Finally, if the target file is smaller than the source, it will continue the
copy (a la `wget -c`) rather than restart from scratch.

The `-X` flag takes a Javascript regular expression to exclude files. If you
want to exclude "Shared With Me" as well (tends to be _huge_ for corporate
accounts),

    cp -rv -X '/Trash|/Shared With Me' /gdrive/username@gmail.com /home/drivebackup

Instead of seeing the progress printed on-screen, you could save it to a log
file.

    cp -crv -X /Trash /gdrive/username@gmail.com /home/drivebackup 2>/home/drivebackup/cplog.$(date -f "YYYY-MM-DD-HHmmss")

You can use `^C` to kill a long-running pipeline, `^B` to continue it in the
background, and `^Z` to pause it. The `ps`, `kill`, `start` and `stop` commands
do what their names suggest.

## Copying To Drive ##

Copying a file is straightforward:

    cd /gdrive/username@gmail.com
    cp /doc/README.md .
    cp http://pigshell.com/sample/photos/bchips.jpg .
    cp /some/where/foo.docx .

These files are stored as-is. Note that `foo.docx` will not be editable as a
Google doc.

Copying a document, i.e. with conversion, requires an extra flag.

    cp -o gdrive.convert /some/where/foo.docx .

## Copying Across Accounts ##

Assuming you have attached multiple accounts, the corresponding Drives are
mounted at `/gdrive/username1@gmail.com` and `/gdrive/username2@gmail.com`.
Copying between these accounts is similar to the process described above.

To copy a document,

    cp -o gdrive.convert /gdrive/username1@gmail.com/Resume /gdrive/username2@gmail.com/resume-dir

Note that we need the `convert` flag to copy documents, if we want them to be
retained as documents in the target Drive.

Copying files is straightforward:

    cp /gdrive/username1@gmail.com/baya.jpg /gdrive/username2@gmail.com/photos

## Updates ##

<a name="14042015"></a>
### 14 Apr 2015 ###

  * The behaviour of the `convert` option has changed.  A file uploaded with
    the `convert` flag now remains a file in the sense defined above. Its MIME
    type is set to 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or similar. You can open such files using Google Docs, at which
    point a document of the same name is created. Now there are two entities -
    the document, and the original file, which remains unaffected by editing
    of the document.

    This means, for instance, that you cannot expect document behaviour like
    exporting to PDF, text, etc. from a freshly 'converted' file. Only the copy
    created by opening it under Google Docs can be subjected to
    `cat -o gdrive.fmt=pdf` and so on.

  * [Bug](http://stackoverflow.com/questions/28337204/cors-on-exportlinks-for-google-docs-spreadsheets-not-working) with CORS support, affecting some
    spreadsheets. Bottom line is that you need to be running [psty](psty.md)
    if you want to copy all sheets. [Reported to Google](https://code.google.com/a/google.com/p/apps-api-issues/issues/detail?id=3737), but don't hold your
    breath.

## Bugs and Gotchas ##

Probably quite a few, only some of which are due to _pigshell_. Google APIs
appear to be insufficiently tested, with simple bugs remaining unfixed for
months, and change behaviour without updates to documentation.

Don't use in production.

-   The "Shared With Me" folder is read-only.
-   Drive has weird ideas of timestamps. _createdDate_, _modifiedDate_,
    _lastViewedByMeDate_ don't mean what they appear to. _Pigshell_ maps the
    first two to the _ctime_ and _mtime_ file attributes. _createdDate_ can be
    later than _modifiedDate_, and _lastViewedByMeDate_ can be older than
    _modifiedDate_. As best as I can make out, _modifiedDate_ is the only sane
    one of the lot. Verify the output of any timestamp-based filtering
    pipelines before doing anything destructive.
-   The "Logout" button doesn't really log you out of Google, just inhibits
    auto-mounting of Drive within _pigshell_.  Most people run _pigshell_ in
    the same browser as their personal GMail, company GMail etc accounts and
    getting logging out of all these is painful.

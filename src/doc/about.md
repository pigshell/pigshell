About
====

[Pigshell](http://pigshell.com) is a pure client-side Javascript app running in
the browser, which presents resources on the web as files.  These include
public web pages as well as private data in Facebook, Google Drive and Picasa
albums. It provides a command line interface to construct pipelines of simple
commands to filter, display and copy data.

**_Pigshell_ is free software**, released under the GNU GPLv3.

[Pigshell](http://pigshell.com) has been developed by
[Coriolis Technologies](http://www.coriolis.co.in), a software company based
in Pune, India. It consists of several components developed by us,
including

1. The _pigshell_ scripting language and interpreter.
2. The shell and terminal interface.
3. "Filesystem" modules to talk to Facebook/Google/Dropbox et al.
4. Built-in commands.

Several external libraries are used. In no particular order,

1.  [PEG.js](http://pegjs.majda.cz) is used to generate the parser for the
    scripting language.
2.  [Docopt](http://docopt.org), specifically the
    [Javascript version](https://github.com/docopt/docopt.coffee). Docopt is
    used by all built-in commands for option processing. It is available to
    scripts as well.
3.  [CodeMirror](http://codemirror.net) editor. The command line is actually a
    single-line editor instance. It also powers the `edit` command.
4.  [Marked](https://github.com/chjj/marked), the markdown parser and compiler
    behind the `markdown` command.
5.  [Async](https://github.com/caolan/async) for asynchronous loop constructs.
6.  [Handlebars](http://handlebarsjs.com) for the `template` command.
7.  [Minimatch](https://github.com/isaacs/minimatch) for converting shell
    globs to Javascript regexes.
8.  [Moment](http://momentjs.com) is behind the `date` command and other
    internal time-crunching.
9.  [Pixastic](http://www.pixastic.com) is used for simple image processing by
    the `pixastic` command. Pixastic has a ton of neat features which will
    eventually be reflected in `pixastic`.
10. [sprintf](http://www.diveintojavascript.com/projects/javascript-sprintf
)
    is used to implement `printf`.
11.  [Google Maps v3 Javascript API](https://developers.google.com/maps/documentation/javascript/) for the `map` command
12.  [JQuery](http://jquery.com)
14. [Cheerio](https://github.com/cheeriojs/cheerio) is used for extracting
    data from HTML strings.
15. [FileSaver.js](http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js) is used to trigger the "download" reflex of the browser.
16. [Canvas to Blob](https://github.com/blueimp/JavaScript-Canvas-to-Blob)
17. [jQuery resize event](http://benalman.com/projects/jquery-resize-plugin/)
18. [Popovers](http://getbootstrap.com/javascript/#popovers) and
    [tooltips](http://getbootstrap.com/javascript/#tooltip) from Bootstrap.
19. [zlib.js](https://github.com/imaya/zlib.js)
20. [canvg.js](http://code.google.com/p/canvg/) for those browsers which
    can't render SVG onto a canvas.
21. [CryptoJS](http://code.google.com/p/crypto-js) for Javascript
    implementations of MD5 and SHA1.
22. Mozilla's [PDF.js](http://mozilla.github.io/pdf.js/) to render PDFs in the terminal.
22. [D3](http://d3js.org) powers visualization commands like `chart` and
    `template`
23. Map colors based on [ColorBrewer](http://www.ColorBrewer.org), by
    Cynthia A. Brewer, Penn State.
24. Country data from https://github.com/mledoze/countries
25. TopoJSON world data (110m, 50m) from Mike Bostock.
25. d3.geo.zoom and d3.geo.projection from
    [Jason Davies](http://www.jasondavies.com)


Contact
-------
Email us at <pigshell@googlegroups.com>, <dev@pigshell.com> or tweet @pigshell

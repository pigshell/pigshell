ROOT = root.tar
PARSER = build/pigpeg.js
CSS = pigshell.css
PIGSHELL = pigshell.js
LIBS = libs.js
RELDIR = build
USRDOCDIR = usr/doc
USRMANDIR = usr/man
PROD_FILES = $(ROOT) $(CSS) $(PIGSHELL) $(LIBS) psty.py extra usr css/fonts images index.html
# Clone from https://github.com/ganeshv/pegjs
PEGJS = pegjs
RONN = ronn

CURDIR = $(shell pwd)

include local.mk
VERSION_MAJOR = 0
VERSION_MINOR = 7
VERSION_PATCH = 0
VERSION_TAG = -dev
VERSION_STR = $(VERSION_MAJOR).$(VERSION_MINOR).$(VERSION_PATCH)$(VERSION_TAG)
VERSION_GIT = $(shell git rev-list --max-count=1 HEAD)

# Keep dependency management simple and stupid for now. A file appears after
# all its dependencies.

CHECK_SOURCES = src/mimeMap.js\
    src/pigutils.js\
    src/cache.js\
    src/vfs.js\
    src/jsonfs.js\
    src/uploads.js\
    src/downloads.js\
    src/shell.js\
    src/commands.js\
    src/term.js\
    src/to.js\
    src/mediaui.js\
    src/magic.js\
    src/lstorfs.js\
    src/facebook.js\
    src/dev.js\
    common/generic-oauth2.js\
    src/auth.js\
    src/init.js\
    src/httpfs.js\
    src/httptx.js\
    src/uri.js\
    src/pstyfs.js\
    src/genmedia.js\
    src/ramfs.js\
    src/picasa.js\
    src/gdrive.js\
    src/dropbox.js\
    src/onedrive.js

LIB_SOURCES = src/lib/jquery-1.7.2.js\
    src/lib/jquery.ba-resize.js\
    src/lib/tooltip.js\
    src/lib/popover.js\
    src/lib/async.js\
    src/lib/FileSaver.js\
    src/lib/canvas-to-blob.js\
    src/lib/docopt.js\
    src/lib/minimatch.js\
    src/lib/sprintf-0.7-beta1.js\
    src/lib/moment.js\
    src/lib/codemirror.js\
    src/lib/marked.js\
    src/lib/unzip.min.js\
    src/lib/cheerio.js

CSS_FILES = css/pigshell.css\
	css/pmarkdown.css\
	css/codemirror.css\
	css/bootstrap.css\
	css/font-awesome.css

USRDOCS = $(addprefix $(USRDOCDIR)/,$(patsubst %.md,%.html,$(notdir $(wildcard src/doc/*.md))))

MANPAGES = $(addprefix $(USRMANDIR)/,$(patsubst %.ronn,%.html,$(notdir $(wildcard src/man/*.ronn))))

all: $(ROOT) $(DOCS) $(USRDOCS) $(MANPAGES) $(LIBS) $(PIGSHELL) $(CSS) etc/httpd-vhosts.conf usr/doc/README.html

release: all
	#@if [ "`git status -s -uno`" != "" ]; then echo Commit or rollback changes before running make release; exit 1; fi
	make check
	mkdir $(RELDIR)/$(VERSION_STR)
	cp -r $(PROD_FILES) $(RELDIR)/$(VERSION_STR)/
	find $(RELDIR)/$(VERSION_STR) -name .gitignore | xargs rm -f

dev: $(ROOT) $(PARSER) $(DOCS)

etc/httpd-vhosts.conf: etc/httpd-vhosts.conf.in src/version.js
	sed 's,PATH_TO_PIGSHELL,$(CURDIR),g;s,PIGSHELL_VERSION,$(VERSION_STR),g' < $< >$@

src/version.js: FORCE
	@printf '!function(){ var pigshell = {version: {str: "%s", major: %d, minor: %d, patch: %d, git: "%s"}, site: {name: "%s", url: "%s"}};\n' $(VERSION_STR) $(VERSION_MAJOR) $(VERSION_MINOR) $(VERSION_PATCH) $(VERSION_GIT) $(SITE_NAME) $(SITE_URL) >$@.mk
	@cmp $@ $@.mk >/dev/null 2>&1 || mv $@.mk $@
	@rm -f $@.mk 

$(ROOT): src/root/bin src/root/usr src/root/etc src/root
	tar --posix -c -C src/root --exclude .gitignore -f $@ .

# Generate html from markdown, changing md->html and tweaking relative links
# Fragile html regexes.

$(USRDOCS): $(USRDOCDIR)/%.html: src/doc/%.md usrheader.html usrfooter.html
	@echo Generating $@ from $<
	@cat usrheader.html >$@
	@marked $< | sed 's|href=\(.*\).md|href=\1.html|g' >>$@
	@cat usrfooter.html >>$@

usr/doc/README.html: README.md usrheader.html usrfooter.html
	@echo Generating $@ from $<
	@cat usrheader.html >$@
	@marked $< | sed -e 's|href="src/doc/\(.*\).md|href="\1.html|g' -e 's|a href="\./|a href="../../|g' -e 's|img src="\./|img src="../../|g' >>$@
	@cat usrfooter.html >>$@

$(MANPAGES): $(USRMANDIR)/%.html: src/man/%.ronn 
	$(RONN) -5 --style=toc --pipe $< >$@

$(LIBS): $(LIB_SOURCES)
	cat $^ > $@

$(PIGSHELL): src/version.js $(CHECK_SOURCES) $(PARSER) src/end.js
	cat $^ > $@

$(PARSER):  src/pigpeg.pegjs
	$(PEGJS) --export-var parser --allowed-start-rules start,TokenList $< $@

$(CSS):	$(CSS_FILES)
	cat $^ > $@

src/commands.js: $(shell ls src/cmd/*js) 
	cat $^ >$@

check: $(CHECK_SOURCES)
	jshint --config jshintrc $(CHECK_SOURCES)

clean:
	rm -f $(DOCS) $(USRDOCS) usr/doc/README.html $(MANPAGES) $(ROOT) $(PIGSHELL) $(LIBS) $(PARSER) $(CSS) src/version.js src/commands.js etc/httpd-vhosts.conf
	rm -rf $(RELDIR)/$(VERSION_STR)

FORCE:

ROOT = root.tar
PARSER = build/pigpeg.js
CSS = pigshell.css
PIGSHELL = pigshell.js
LIBS = libs.js
RELDIR = build
USRDOCDIR = usr/share/doc
DOCDIR = doc
USRMANDIR = usr/share/man
PROD_FILES = $(ROOT) $(CSS) $(PIGSHELL) $(LIBS) $(DOCDIR) psty.py extra usr css/fonts images index.html
#PEGJS = pegjs
# Clone from https://github.com/ganeshv/pegjs
PEGJS = ~/tmp/pegjs/bin/pegjs
RONN = ronn

VERSION_MAJOR = 0
VERSION_MINOR = 6
VERSION_PATCH = 3
VERSION_TAG = -pre3
VERSION_STR = $(VERSION_MAJOR).$(VERSION_MINOR).$(VERSION_PATCH)$(VERSION_TAG)
VERSION_GIT = $(shell git rev-list --max-count=1 HEAD)

# Keep dependency management simple and stupid for now. A file appears after
# all its dependencies.

CHECK_SOURCES = src/mimeMap.js\
    src/pigutils.js\
    src/cache.js\
    src/vfs.js\
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
    src/ramfs.js\
    src/picasa.js\
    src/gdrive.js\
    src/dropbox.js

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

DOCS = $(addprefix $(DOCDIR)/,$(patsubst %.md,%.html,$(notdir $(wildcard src/doc/*.md))))

USRDOCS = $(addprefix $(USRDOCDIR)/,$(patsubst %.md,%.html,$(notdir $(wildcard src/doc/*.md))))

MANPAGES = $(addprefix $(USRMANDIR)/,$(patsubst %.ronn,%.html,$(notdir $(wildcard src/man/*.ronn))))

all: $(ROOT) $(DOCS) $(USRDOCS) $(MANPAGES) $(LIBS) $(PIGSHELL) $(CSS)

release: all
	#@if [ "`git status -s -uno`" != "" ]; then echo Commit or rollback changes before running make release; exit 1; fi
	make check
	mkdir $(RELDIR)/$(VERSION_STR)
	cp -r $(PROD_FILES) $(RELDIR)/$(VERSION_STR)/
	find $(RELDIR)/$(VERSION_STR) -name .gitignore | xargs rm -f

dev: $(ROOT) $(PARSER) $(DOCS)

src/version.js: FORCE
	@if [ -f $@ ]; then \
		if [ X`sed 's/.*str:[^"]*"\([^"]*\).*/\1/' < $@` = X$(VERSION_STR) ] && \
			[ X`sed 's/.*git:[^"]*"\([^"]*\).*/\1/' < $@` = X`git rev-list --max-count=1 HEAD` ]; then \
			exit 0; \
		fi; \
	fi; \
	printf '!function(){ var pigshell = {version: { str: "%s", major: %d, minor: %d, patch: %d, git: "%s" }};\n' $(VERSION_STR) $(VERSION_MAJOR) $(VERSION_MINOR) $(VERSION_PATCH) $(VERSION_GIT) >$@
	
$(ROOT): src/root/bin src/root/usr src/root/etc src/root
	tar --posix -c -C src/root --exclude .gitignore -f $@ .

$(DOCS): $(DOCDIR)/%.html: src/doc/%.md header.html footer.html
	cat header.html >$@
	marked $< >>$@
	cat footer.html >>$@

$(USRDOCS): $(USRDOCDIR)/%.html: src/doc/%.md usrheader.html usrfooter.html
	cat usrheader.html >$@
	marked $< >>$@
	cat usrfooter.html >>$@

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
	rm -f $(DOCS) $(USRDOCS) $(MANPAGES) $(ROOT) $(PIGSHELL) $(LIBS) $(PARSER) $(CSS) src/version.js src/commands.js
	rm -rf $(RELDIR)/$(VERSION_STR)

FORCE:

#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
JSFILES="../js/auth.js ../js/facebook.js ../js/picasa.js ../js/final/root.js ../js/uploads.js ../js/cache.js ../js/gdrive.js ../js/shell.js ../js/vfs.js ../js/commands.js ../js/lstorfs.js ../js/pigshell.js ../js/dev.js ../js/mimeMap.js ../js/pigutils.js ../js/term.js ../js/downloads.js ../js/lib/*.js"
TARGET="../js/final/compiled.js"
OPT="WHITESPACE_ONLY" # Alternatives are SIMPLE_OPTIMIZATIONS, ADVANCED_OPTIMIZATIONS, WHITESPACE_ONLY
CLOSURE="--only_closure_dependencies"
CLOSURE_ENTRY_POINT="--closure_entry_point auth"
MANIFEST="MANIFEST.mf"
FORMATTING=""
#FORMATTING="--formatting PRETTY_PRINT"

# go to build folder
pushd $DIR

# compile code to single file
java -jar compiler.jar --js $JSFILES --js_output_file $TARGET --compilation_level $OPT --output_manifest $MANIFEST $FORMATTING $CLOSURE $CLOSURE_ENTRY_POINT

# sed remove goog.provide and goog.require calls and empty lines
sed -i.bak -e 's/goog\.provide[^;]*;//g;s/goog\.require[^;]*;//g;/^$/d' $TARGET

# delete sed backup file
rm $TARGET.bak

# delete manifest file
rm $MANIFEST

# compile code to single file
#java -jar compiler.jar --js $TARGET --js_output_file $TARGET.s --compilation_level SIMPLE_OPTIMIZATIONS

# return to original folder
popd

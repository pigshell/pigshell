require("../../build/pigpeg.js");
var args = process.argv.slice(2);
var source = require('fs').readFileSync(require('path').resolve(args[0]), "utf8");
var maxrules = source.length * 100;
maxrules = (maxrules < 100000) ? 100000 : maxrules;

try {
    //var ast = parser.parse(source, {maxrules: maxrules});
    var ast = parser.parse(source);
    console.log(JSON.stringify(ast, null, 4));
    process.exit(0);
} catch(e) {
    console.log(e.message);
    console.log('Line: ' + e.line, ' Col: ' + e.column + ' Offset: ' + e.offset);
    process.exit(1);
}

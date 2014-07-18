require("../../build/pigpeg.js");
var args = process.argv.slice(2);
var source, cwd, filename = args[0] || 't3';
source = require('fs').readFileSync(require('path').resolve(filename), "utf8");

try {
    var ast = parser.parse(source, {'startRule': 'start', 'trace': ['BlockList','Function', 'StatementBlock', 'Statement', 'Command' , 'Concat', 'IfStatement', 'ElifBlock', 'DoubleStringCharacter', 'HexDigit'], 'tabspace': 2, maxrules: source.length * 100});
    console.log(JSON.stringify(ast, null, 4));
} catch(e) {
    console.log(e.message);
    console.log('Line: ' + e.line, ' Col: ' + e.column + ' Offset: ' + e.offset);
}

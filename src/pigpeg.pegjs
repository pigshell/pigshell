/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

start
    = ___ program:Program ___ EOF { return program; }

Program "Program"
    = elements:BlockList? EOS* {
        return elements;
    }

BlockList "BlockList"
    = head:(Function / StatementBlock) tail:(EOS _ (Function / StatementBlock))* {
        var result = head;
        for (var i = 0; i < tail.length; i++) {
            result = result.concat(tail[i][2]);
        }
        return result;
    }

Function "Function"
    = "function" __ fname:Identifier ___ "{" ___ body:StatementBlock? EOS _ "}" {
        return [{'FUNCTION': [fname, body]}];
    }
    / "function" __ fname:Identifier ___ "{" ___ "}" {
         return [{'FUNCTION': [fname, []]}];
    }
    / "function" __ fname:Identifier &(EOS / EOF) {
        return [{'FUNCTION': [fname, null]}];
    }

StatementBlock "StatementBlock"
    = head:Statement tail:(EOS _ Statement)* {
        var result = [head];
        for (var i = 0; i < tail.length; i++) {
            result.push(tail[i][2]);
        }
        return result;
    }

Statement "Statement"
    = statement:(WhileStatement / ForStatement / IfStatement / AssignStatement / ReturnStatement / OrStatement / EmptyStatement) { return statement; }

WhileStatement "WhileStatement"
    = "while" __ cond:OrStatement EOS+ _ "do" (EOS _ / __) body:StatementBlock EOS _ "done" {
        return {'WHILE': [cond, body]};
    }

ForStatement "ForStatement"
    = "for" __ id:Identifier __ "in" __ head:Argword tail:(__ Argword)* EOS+ _ "do" (EOS _ / __) body:StatementBlock EOS _ "done" {
        var args = [head];
        for (var i = 0; i < tail.length; i++) {
            args.push(tail[i][1]);
        }
        return {'FOR': [id, {'ARGLIST': args}, body]};
    }

IfStatement "IfStatement"
    = "if" __ ifnot:("!" __)? cond:OrStatement EOS+ _ "then" (EOS _ / __) body:StatementBlock elif:(EOS _ ElifBlock)* EOS _ tail:IfTail {
        var result = {},
            ifblock = {},
            op = (ifnot.length === 0) ? 'IF' : 'IFNOT',
            ifblocks = [];
        ifblocks.push([op, cond, body]);
        for (var i = 0; i < elif.length; i++) {
            ifblocks.push(elif[i][2]);
        }
        result['IF'] = [ifblocks, tail];
        return result;
    }

ElifBlock "ElifBlock"
    = "elif" __ ifnot:("!" __)? cond:OrStatement EOS+ _ "then" (EOS _ / __) body:StatementBlock {
        var result;
            op = (ifnot.length === 0) ? 'IF' : 'IFNOT';
        result = [op, cond, body];
        return result;
    }

IfTail "IfTail"
    = "else" (EOS _ / __) elseblock:StatementBlock EOS _ "fi" { return elseblock; }
    / "fi" { return [];}

AssignStatement
    = id:Identifier "=" arg:Argword {
        var result = {'ASSIGN': {}};
        result['ASSIGN'][id] = arg;
        return result;
    }

ReturnStatement
    = "return" arg:(__ Argword)? {
        var retval = (arg.length === 0) ? '' : arg[1],
            result = {'RETURN': retval};
        return result;
    }

OrStatement "OrStatement"
    = head:AndStatement tail:(_ "||" _ AndStatement)* {
        var result = head;
        for (var i = 0; i < tail.length; i++) {
            result = {'OR': [result, tail[i][3]]};
        }
        return result;
    }

AndStatement "AndStatement"
    = head:SimpleStatement tail:(_ "&&" _ SimpleStatement)* {
        var result = head;
        for (var i = 0; i < tail.length; i++) {
            result = {'AND': [result, tail[i][3]]};
        }
        return result;
    }

SimpleStatement "SimpleStatement"
    = head:(PipeCommand / SimpleCommand) tail:(_ Redir)* {
        if (tail.length === 0) {
            return head;
        }
        var redir = [];
        for (var i = 0; i < tail.length; i++) {
            redir.push(tail[i][1]);
        }
        head['TAIL'] = redir;
        return head;
    }
    
EmptyStatement "EmptyStatement"
    = &EOS {return '';}


Redir "Redir"
    = ">>" _ arg:Argword { return {'REDIRAPPEND': arg}; }
    / ">" _ arg:Argword { return {'REDIROUT': arg}; }
    / "2>" _ arg:Argword { return {'REDIR2OUT': arg}; }
    / "2>>" _ arg:Argword { return {'REDIR2APPEND': arg}; }
    / "<" _ arg:Argword { return {'REDIRIN': arg}; }

PipeCommand "PipeCommand"
    = head:SimpleCommand tail:(_ "|" _ SimpleCommand)+ &EOCP {
        var result = [head];
        for (var i = 0; i < tail.length; i++) {
            result.push(tail[i][3]);
        }
        return {'PIPE': result};
    }

SimpleCommand "SimpleCommand"
    = head:Command tail:(__ Argword)* &EOC {
        var result = [head];
        for (var i = 0; i < tail.length; i++) {
            result.push(tail[i][1]);
        }
        return {'ARGLIST': result};
    }

Command
    = !(Keyword EOC / "}") cmd:Argword { return cmd;}


Identifier "Identifier"
    = head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
        var result = head + tail.join("");
        return result;
    }

TokenList
    = _ head:Argword _ tail:((Argword / SimpleCmdSep / "$(") _ )* (WhiteSpace / LineTerminator)* {
        var result = [head];
        for (var i = 0; i < tail.length; i++) {
            result.push(tail[i][0]);
        }
        return result;
    }

Argwordlist
    = head:Argword tail:(__ Argword)* {
        var result = [head];
        for (var i = 0; i < tail.length; i++) {
            result.push(tail[i][1]);
        }
        return result;
    }

Argword "Argword"
    = Concat
    / Argword2

Argword2 "Argword2"
    = arg:(Deferred / Backquote / Varlen / Varjoin / Varref / List / StringLiteral) {
        return arg;
    }

List
    = "(" _ args:Argwordlist? _ ")" {
        return {'LIST': args};
    }

VarIdentifier = Identifier / "?" / "*" / "!" / "#" / Number

Varlen "Varlen"
    = "$#" id:(VarIdentifier) {
        return {'VARLEN': id};
    }

Varjoin "Varjoin"
    = "$\"" id:(VarIdentifier) {
        return {'VARJOIN': id};
    }

Varref "Varref"
    = "$" id:(VarIdentifier) "(" _ slist:Argwordlist? _ ")" {
        return {'VARVAL': [id, slist]};
    }
    / "$" id:(VarIdentifier) {
        return {'VARVAL': id}
    }

Number
    = num:[0-9]+ { return num.join("");}

Concat
    = head:Argword2 tail:("^"? Argword2)+ {
        var result = head;
        for (var i = 0; i < tail.length; i++) {
            result = {"^": [result, tail[i][1]]};
        }
        return result;
    }

Backquote
    = "$(" _ cmds:StatementBlock _ ")" {
        return {'BACKQUOTE': cmds};
    }

Deferred
    = "${" _ cmds:StatementBlock _ "}" {
        return {'DEFERRED': cmds};
    }

StringLiteral "StringLiteral"
    = parts:('"' DoubleStringCharacters? '"') {
        return {'DQUOTED_STRING': parts[1]};
    }
    / parts:("'" SingleStringCharacters? "'") {
        return {'SQUOTED_STRING': parts[1]};
    }
    / BareStringCharacters

DoubleStringCharacters
    = chars:DoubleStringCharacter+ { return chars.join(""); }

SingleStringCharacters
    = chars:SingleStringCharacter+ { return chars.join(""); }

DoubleStringCharacter
    = !('"' / "\\" / LineTerminator) char:SourceCharacter { return char; }
    / qc:QuotedCharacter { return qc; }

SingleStringCharacter
    = !("'" / "\\" / LineTerminator) char:SourceCharacter { return char; }
    / qc:QuotedCharacter { return qc; }

QuotedCharacter
    = "\\0" { return "\0"; }
    / "\\b" { return "\b"; }
    / "\\t" { return "\t"; }
    / "\\n" { return "\n"; }
    / "\\v" { return "\v"; }
    / "\\f" { return "\f"; }
    / "\\r" { return "\r"; }
    / "\\x" sequence:(HexDigit HexDigit) { return String.fromCharCode(parseInt("0x" + sequence.join(''))); }
    / "\\u" sequence:(HexDigit HexDigit HexDigit HexDigit) { return String.fromCharCode(parseInt("0x" + sequence.join(''))); }
    / "\\" sequence:('"' / "'" / "\\" / LineTerminator) { return sequence; }
    / "\\" sequence:SourceCharacter { return "\\" + sequence; }

HexDigit
    = num:[0-9a-fA-F] { return num; }

BareStringCharacters "BareString"
    = chars:BareStringCharacter+ {
        return chars.join("");
    }

BareStringCharacter
    = !(WhiteSpace / LineTerminator / SimpleCmdSep / "$" / "#" / '"' / "\\" / "'") char:SourceCharacter { return char;}
    / "\\" sequence:SourceCharacter { return sequence; }

PipeCmdSep
    = [\|&><\(\)\^};]
    / "2>"
    / "2>>"

SimpleCmdSep =
    PipeCmdSep
    / "|"

EOC
    = SimpleCmdSep / WhiteSpace / LineTerminator / EOF

EOCP
    = PipeCmdSep / WhiteSpace / LineTerminator / EOF

EOS
    = _ Comment* ";"
    / _ Comment* LineTerminatorSequence
___
    = (WhiteSpace / LineTerminatorSequence / Comment)*
_
    = WhiteSpace*

__
    = WhiteSpace+

LineTerminator
    = [\n\r]

LineTerminatorSequence
    = "\n"
    / "\r\n"
    / "\r"

WhiteSpace
    = [\t\v\f ]

Comment
    = "#" (!LineTerminator .)*

SourceCharacter
    = .

EOF
    = !.

Keyword
    = ("function" / "if" / "then" / "elif" / "else" / "fi" / "for" / "in" / "done" / "do" / "while" / "!" / "return")

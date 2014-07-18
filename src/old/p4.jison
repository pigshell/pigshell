/* description: Pigshell parser */

/* lexical grammar */
%lex
digit                       [0-9]
esc                         "\\"
cmdsep                      [\s;\|&]
%%


^[^\S\n]*\#.*\n             /* skip full line comment, swallow newline */
\#[^\n]*                    /* skip comment, preserve nl as cmd separator */
';'[\s;]*                   return ';'
'!='                        return 'BARE_STRING'
'=='                        return 'BARE_STRING'
'<='                        return 'BARE_STRING'
'>='                        return 'BARE_STRING'
'||'                        return '||'
'|'                         return '|'
'&&'                        return '&&'
'='                         return '='
\$([a-zA-Z0-9_\*\#\?\!])+   yytext = yytext.substr(1, yyleng - 1); return 'VARREF'
'$'                         return '$'
'>>'                        return '>>'
'>'                         return '>'
'<'                         return '<'
'('                         return '('
')'                         return ')'
'^'                         return '^'
'!'                         return '!'
'if'                        return 'IF'
'then'\s+                   return 'THEN'
'elif'                      return 'ELIF'
'else'\s+                   return 'ELSE'
'fi'                        return 'FI'
'for'                       return 'FOR'
'in'                        return 'IN'
'do'\s+                     return 'DO'
'done'                      return 'DONE'
'while'                     return 'WHILE'
\n+                         return ';' /* subtle! If we left it \n, jison makes it \n\b, which means '\n ' will get collapsed to nothing due to the \s+ rule down below */
\'(?:[^\'\n])*\'       yytext = yytext.substr(1,yyleng-2); return 'SQUOTED_STRING';
\"(?:[^\"\n])*\"       yytext = yytext.substr(1,yyleng-2); return 'DQUOTED_STRING';
(?:\\.|[^\s;\|&=><\$\(\)\^])+     return (yytext.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) ? 'ID' : 'BARE_STRING'
[^\S\n]+                    /* skip whitespace */
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */
%left '+'
%left 'IF' 'FOR' 'WHILE' '!'
%left '&&' '||'
%left MIDPREC
%right '>' '<' '>>'
%left '|'
%left '^'
%left '=' HIGHPREC
%right '$' 'VARREF'

%start psh

%% /* language grammar */

psh:    line   {return $1;}
    ;

line:   dcmd 
        {$$ = [$dcmd];}
    |   line ';' dcmd
        {$$ = $line;$$.push($dcmd);}
    |   line 'EOF'
    ;

dcmd:   ccmd
    |   ifcmd
    |   forcmd
    |   whilecmd
    |   assign
        {$$ = yy.assign({}, $assign);}
    |   'EOF' | ';'
        {$$ = ''}
    ;    

ccmd:   bcmd
    |   ccmd '&&' ccmd
        {$$ = {'AND': [$ccmd1, $ccmd2]};}
    |   ccmd '||' ccmd
        {$$ = {'OR': [$ccmd1, $ccmd2]};}
    ;

bcmd:   acmd
    |   bcmd redir
        {$$ = yy.tail($bcmd, $redir);}
    ;

acmd:   simplecmd
    |   acmd '|' acmd
        {$$ = yy.lflatten('PIPE', $acmd1, $acmd2);}
    ;

redir:  '>' argword
        {$$ = {'REDIROUT': $argword};}
    |   '<' argword
        {$$ = {'REDIRIN': $argword};}
    |   '>>' argword
        {$$ = {'REDIRAPPEND': $argword};}
    ;

ifcmd:  'IF' ccmd ';' 'THEN' line ';' iftail
        {$$ = {'IF': [$ccmd, $line, $iftail]};}
    |   'IF' '!' ccmd ';' 'THEN' line ';' iftail
        {$$ = {'IFNOT': [$ccmd, $line, $iftail]};}
    ;

iftail: 'FI'
        {$$ = [];}
    |   'ELSE' line ';' 'FI'
        {$$ = $line;}
    ;

forcmd: 'FOR' ID 'IN' argwordlist ';' 'DO' line ';' 'DONE'
        {$$ = {'FOR': [$ID, $argwordlist, $line]};}
    ;

whilecmd:  'WHILE' ccmd ';' 'DO' line ';' 'DONE'
        {$$ = {'WHILE': [$ccmd, $line]};}
    ;

assign: ID '=' argword
        {$$ = [$ID, $argword];}
    ;

simplecmd:  ID
        {$$ = {'ARGLIST': [$ID]};}
    |   simplecmd argword
        {$$ = yy.lflatten('ARGLIST', $simplecmd, $argword);}
    ;

argwordlist:    argword
        {$$ = {'ARGLIST': [$argword]};}
    |   argwordlist argword
        {$$ = yy.lflatten('ARGLIST', $argwordlist, $argword);}
    ;

argword:    SQUOTED_STRING
        {$$ = {'SQUOTED_STRING': yytext};}
    |   DQUOTED_STRING
        {$$ = {'DQUOTED_STRING': yytext};}
    |   ID
    |   keyword
    |   BARE_STRING
            {$$ = yy.unescape('BARE_STRING', yytext);}
    |   VARREF
            {$$ = {'VARVAL': yytext};}
    |   '$' '(' line ')'
            {$$ = {'BACKQUOTE': $line};}
    |   argword '^' argword
        {$$ = yy.lflatten('^', $argword1, $argword2);}
    ;

keyword:    'FOR'|'IN'|'DO'|'DONE'|'IF'|'THEN'|'ELIF'|'FI'|'WHILE'
    ;

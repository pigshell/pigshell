#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "markdown tests started on" $(date)

dtest markdown.1 "markdown /home/src/doc/pigshell.md | jf 'x.div[0].outerHTML'"

TESTMD='# TITLE\n\nThis is a markdown document\n\n ## Subsection\n\n  - Bullet\n  - Another bullet\n'

dtest markdown.2 "echo $TESTMD | markdown | jf 'x.div[0].outerHTML'"

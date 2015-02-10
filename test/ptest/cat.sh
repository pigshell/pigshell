#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "cat tests started on" $(date)

TESTFILES=(/tmp/Tcat.1 /tmp/Tcat.2)

dtest cat.1 "echo foo | cat"

echo foo >$TESTFILES(0)
echo bar >$TESTFILES(1)

dtest cat.2 "ls -d $TESTFILES | cat"
dtest cat.3 cat $TESTFILES
dtest cat.4 "cat $TESTFILES(0) | cat"

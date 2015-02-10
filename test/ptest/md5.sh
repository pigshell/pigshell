#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "md5 tests started on" $(date)

TESTFILES=(/tmp/Tmd5.1 /tmp/Tmd5.2)

dtest md5.1 "echo -n | md5"
dtest md5.2 "echo -n foo | md5"
dtest md5.3 "md5 -s foo"

echo foo >$TESTFILES(0)
echo bar >$TESTFILES(1)

dtest md5.4 "md5 $TESTFILES"
dtest md5.5 "ls -d $TESTFILES | md5"
dtest md5.6 "cat $TESTFILES | md5"

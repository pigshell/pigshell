#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "rm tests started on" $(date)

TESTDIR=/tmp/Trm.1
mkdir $TESTDIR
echo foo >$TESTDIR/Trm.2
echo bar >$TESTDIR/Trm.3
echo baz >$TESTDIR/Trm.4

DEATHSTAR=()
rm -r $TESTDIR 2>/dev/null
dont_expect $? true rm.1

rm $TESTDIR/Trm.2
expect $? true rm.2
ls $TESTDIR >/dev/null
ls -d $TESTDIR/Trm.2 2>/dev/null
dont_expect $? true rm.3

DEATHSTAR=1
rm -r $TESTDIR
expect $? true rm.4
ls /tmp >/dev/null
ls -d $TESTDIR 2>/dev/null
dont_expect $? true rm.4
DEATHSTAR=()

#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "sort tests started on" $(date)

TEST1="baker\nable\ncharlie\n"
TEST2="5\n1\n4\n2\n3\n100\n10\n"
TESTFILES=(/tmp/Tsort.1 /tmp/Tsort.2)
TESTOBJ1=$(jf '{data: +x, foo: 10}' 10 1 4 2 3)
TESTOBJ2=$(jf '{data: x}' baker able charlie)

echo -n $TEST1 >$TESTFILES(0)
echo -n $TEST2 >$TESTFILES(1)

dtest sort.1 "cat $TESTFILES(0) | to lines | sort"
dtest sort.2 "cat $TESTFILES(0) | to lines | sort -r"
dtest sort.3 "cat $TESTFILES(1) | to lines | sort -n"
dtest sort.4 "cat $TESTFILES(1) | to lines | sort -nr"

dtest sort.5 "echo $TESTOBJ1 | sort -f data | printf"
dtest sort.6 "echo $TESTOBJ1 | sort -sf data | printf"
dtest sort.7 "echo $TESTOBJ1 | sort -e 'x.data + x.foo' | printf"
dtest sort.8 "echo $TESTOBJ2 | sort -f data | printf"
dtest sort.9 "echo $TESTOBJ2 | sort -re 'x.data' | printf"

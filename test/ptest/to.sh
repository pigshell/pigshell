#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "to tests started on" $(date)

TESTFILE=/home/src/doc/pigshell.md
IMAGEFILE=$SAMPLEDIR/oslogos.png

dtest to.1 "cat $TESTFILE | to text"
dtest to.2 "cat $TESTFILE | to lines | sum"
dtest to.3 "cat $TESTFILE | to text | to blob"
dtest to.4 "cat $IMAGEFILE | to canvas | to blob"

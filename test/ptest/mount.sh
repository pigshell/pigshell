#!pigshell

# Tests for mount

sh -s testlib.sh

MNT1=/tmp/mnttest1
MNT2=/tmp/mnttest2
mkdir $MNT1 2>/dev/null
mkdir $MNT2 2>/dev/null
mount http://pigshell.com/v/0.6.2/usr/ $MNT1
[ -f $MNT1/share/doc/README.html ]
expect $? true mount.1
mount http://pigshell.com/v/0.6.2/usr/ $MNT2/
[ -f $MNT2/share/doc/README.html ]
expect $? true mount.2

#umount $MNT2
#umount $MNT1

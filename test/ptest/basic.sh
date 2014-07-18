#!pigshell

# Basic tests.

sh -s testlib.sh
echo "Basic tests started on" $(date)

PSTYFS="http://localhost:50937/"
TMNT=(/tmnt1 /tmnt2)

mkdir $TMNT
#expect $? true mkdir.1

help >$RESDIR/help.1
dcheck $? true help.1

# A few globbing tests
mkdir /doc
cp /home/src/doc/*md /doc
mkdir /ttmp
mkdir /ttmp/t1 /ttmp/t2
cp /doc/*md /ttmp
cp /doc/*md /ttmp/t1
cp /doc/*md /ttmp/t2
echo falabala >/ttmp/t2/"A file"
cwd=$(pwd)

cd /ttmp/t1
echo ../* >$RESDIR/glob.1
dcheck $? true glob.1

cd /
echo ttmp/t1/../* >$RESDIR/glob.2
dcheck $? true glob.2

echo ttmp/*/../* >$RESDIR/glob.3
dcheck $? true glob.3

echo ttmp/*/*md >$RESDIR/glob.4
dcheck $? true glob.4

echo ttmp/*2////* >$RESDIR/glob.5
dcheck $? true glob.5

echo /ttmp/*/ >$RESDIR/glob.6
dcheck $? true glob.6

cd $cwd

mount -o html_nodir $PSTYFS $TMNT(0)
expect $? true mount.1
mount $PSTYFS $TMNT(1)
expect $? true mount.2

for i in 0 1; do
    X=$TMNT($i)
    ls -l $X/$TDIR > $RESDIR/ls.$i.1
    dcheck $? true ls.$i.1

    ls -lR $X/$TDIR/directory\ 1  >$RESDIR/ls.$i.2
    dcheck $? true ls.$i.2

    ls -ld $X/$TDIR >$RESDIR/ls.$i.3
    dcheck $? true ls.$i.3

    ls -ld $X/$TDIR/ >$RESDIR/ls.$i.4
    dcheck $? true ls.$i.4

    rm $RESDIR/foo
    echo -n "abcd" >$RESDIR/foo
    size=$(ls -d $RESDIR/foo | printf "%(size)s")
    expect $size 4 write.$i.1 debug
    echo -n "abcd" >>$RESDIR/foo
    size=$(ls -d $RESDIR/foo | printf "%(size)s")
    expect $size 8 write.$i.2
    data=$(cat $RESDIR/foo | to text)
    expect $data "abcdabcd" write.$i.3

done

cat $X/$TDIR/photos/bchips.jpg | wsh /usr/local/bin/convert -implode 1 - - >$RESDIR/wsh.1
dcheck $? true wsh.1
wsh file results/wsh.1 >$RESDIR/wsh.2
dcheck $? true wsh.2

X=$X/$TMPDIR
mkdir $X/mkdirtest
expect $? true mkdir.1
cp /doc/README.md $X/mkdirtest
expect $? true cp.1
cmp /doc/README.md $X/mkdirtest/README.md
expect $? true cp.2
cp /doc/README.md $X/mkdirtest/README2.md
expect $? true cp.3
cmp /doc/README.md $X/mkdirtest/README2.md
expect $? true cp.4
rm $X/mkdirtest 2>/dev/null
dont_expect $? true rm.1
rm $X/mkdirtest/README*.md
expect $? true rm.2
rm $X/mkdirtest
expect $? true rm.3

X=/tmp/mvtest
mkdir $X
mv /doc/*md $X
res=$?
ls -G $X >$RESDIR/mv.1
dcheck $res true mv.1
Y=/tmp/mvtest2
mkdir $Y
ls $X | grep -e 'x.size > 2000' | mv $Y
res=$?
ls -G $Y >$RESDIR/mv.2
dcheck $res true mv.2
ls $Y | cp $X
res=$?
ls -G $X >$RESDIR/cp.5
dcheck $res true cp.5
ls $Y | rm
res=$?
ls -G $Y >$RESDIR/rm.4
dcheck $res true rm.4

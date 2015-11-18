#!pigshell

# Basic tests.

sh -s testlib.sh
echo "Basic tests started on" $(date)

PSTYFS=$(jf window.location.protocol 1)//localhost:50937/
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
    ls -T $X/$TDIR > $RESDIR/ls.$i.1
    dcheck $? true ls.$i.1

    ls -TR $X/$TDIR >$RESDIR/ls.$i.2
    dcheck $? true ls.$i.2

    ls -Td $X/$TDIR >$RESDIR/ls.$i.3
    dcheck $? true ls.$i.3

    ls -Td $X/$TDIR/ >$RESDIR/ls.$i.4
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
mkdir $X 2>/dev/null
mkdir $X/mkdirtest
expect $? true mkdir.1
cp /doc/pigshell.md $X/mkdirtest
expect $? true cp.1
cmp /doc/pigshell.md $X/mkdirtest/pigshell.md
expect $? true cp.2
cp /doc/pigshell.md $X/mkdirtest/pigshell2.md
expect $? true cp.3
cmp /doc/pigshell.md $X/mkdirtest/pigshell2.md
expect $? true cp.4
rm $X/mkdirtest 2>/dev/null
dont_expect $? true rm.1
rm $X/mkdirtest/pigshell*.md
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

bq1=$(echo -n)
expect $? true backquote.1
expect $#bq1 0 backquote.2

list1=(able baker)
list2=$list1(0 1 2 3 4)
list3=$list1(5)
[ $#list1 -eq 2 ]
expect $? true var.1
[ $#list2 -eq 2 ]
expect $? true var.2
[ $#list3 -eq 0 ]
expect $? true var.3

echo <<EOH
This here's
a string most weird!
where \n and \r and "quotes" and | and # this is not a comment
all other delims $foo
which would otherwise signal the end;
are allowed to proliferate
& what's more (x*)
the EOH itself must appear at the beginning of the line
to mark the end of this here doc [1]

x* who could've thunk?
[1] but not the pipeline or even the argument list. Unlike other shells,
here documents do not expand $variables and can be used anywhere a string
can. This makes it very easy to create arbitrary \ free text arguments
without worrying too much about what may or may not need to be escaped
EOH <<EOH
Another here document
not as verbose as the one before
EOH >$RESDIR/heredoc.1
dcheck $? true heredoc.1

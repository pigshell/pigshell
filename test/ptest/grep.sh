#!pigshell

# Tests for grep and fgrep

sh -s testlib.sh

grep foo fo o bar "baz\nf" oo2 >$RESDIR/grep.1
dcheck $? true grep.1

cat http://pigshell.com/sample/life-expectancy.html | table2js -e "tr" foo country data | grep -e '+x.data < 50' | printf >$RESDIR/grep.2
dcheck $? true grep.2

fgcount=$(fgrep pigshell /home/src/doc/*md | sum)
gcount=$(wsh sh -c 'cat ../../src/doc/*' | grep pigshell | sum)
ucount=$(wsh sh -c 'cat ../../src/doc/* | grep pigshell | wc -l' | to text)

if [ $fgcount -gt 40 ] && [ $fgcount = $gcount ] && [ $gcount = $ucount ]; then
    expect 1 1 grep.3
else
    echo fgcount $fgcount
    echo gcount $gcount
    echo ucount $ucount
    expect 1 0 grep.3
fi

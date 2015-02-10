#!pigshell

TESTS=(basic.sh echo.sh printf.sh md5.sh E.sh T.sh cat.sh markdown.sh next.sh sort.sh sum.sh to.sh csv.sh grep.sh join.sh mount.sh rm.sh cp.sh)

for t in $TESTS; do
    ./$t
    echo
done

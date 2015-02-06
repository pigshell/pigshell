#!pigshell

TESTS=(basic.sh cp.sh csv.sh grep.sh join.sh mount.sh)

for t in $TESTS; do
    ./$t
    echo
done

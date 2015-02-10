#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "printf tests started on" $(date)

TESTOBJ1=$(jf '{data: +x, foo: 10}' 10 1 4 2 3)
TESTOBJ2=$(jf '{name: x}' baker able charlie)

# Basic format characters
printf -s "%% %b %c %d %d %e %u %f %o %s %x %X\n" 240 65 567 567.677 2995.459 -1 2995.459 9 "able baker" 51966 51966 >$RESDIR/printf.1
dcheck $? true printf.1

# Leading sign
printf -s "%+d %+f %+d %+f\n" 10 10.5 -10 -10.5 >$RESDIR/printf.2
dcheck $? true printf.2

# Field width, padding
printf -s "%'X4d\n%4d\n%'X-4d\n%-4dEOL\n%'X6.2f\n" 10 10 10 10 10.589242 >$RESDIR/printf.3
dcheck $? true printf.3

# Argument swapping
printf -s "%2$'X10.2f\n%1$d\n" 10.685 11.485 >$RESDIR/printf.4
dcheck $? true printf.4

# Named argument
echo $TESTOBJ1 | printf "%(data)d %(foo)s\n" >$RESDIR/printf.5
dcheck $? true printf.5

echo $TESTOBJ2 | printf "%(name)s\n" >$RESDIR/printf.6
dcheck $? true printf.6

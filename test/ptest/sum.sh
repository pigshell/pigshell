#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "sum tests started on" $(date)

OBJS=$(jf '{data: +x, foo: 10}' 100 200 300 400 500 1)

dtest sum.1 "echo $OBJS | sum"
dtest sum.2 "echo $OBJS | sum -f data"
dtest sum.3 "echo $OBJS | sum -e 'x.data * x.foo'"

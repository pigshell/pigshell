#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "echo tests started on" $(date)

OBJS=$(jf '{data: x}' able baker charlie)

dtest echo.1 echo
dtest echo.2 echo -n
dtest echo.3 echo foo bar baz
dtest echo.4 echo -n foo bar baz
dtest echo.5 "echo $OBJS | printf"
dtest echo.6 "echo 1 2 3 4 5 | sum"
dtest echo.7 "echo -r 1 2 3 4 5 | sum"

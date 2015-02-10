#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "E tests started on" $(date)

dtest E.1 E 1
dtest E.2 E 1 + 1

E 1 + 2>/dev/null
dont_expect $? true E.3

dtest E.4 E '5+4'

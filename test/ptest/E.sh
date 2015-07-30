#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "E tests started on" $(date)

dtest E.1 E 1
dtest E.2 E 1 + 1

E 1 + 2>/dev/null
dont_expect $? true E.3

dtest E.4 E '5+4'

dtest E.5 "E 1 | jf 'typeof(x)'"
dtest E.6 "E /pATTern/g | jf 'x instanceof RegExp'"
dtest E.7 "E true | jf 'typeof(x)'"

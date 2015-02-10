#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "next tests started on" $(date)

cmd=${echo -r 1 2 3}

dtest next.1 "next $cmd"
dtest next.2 "next $cmd"
dtest next.3 "next $cmd"
dtest next.4 "next $cmd"

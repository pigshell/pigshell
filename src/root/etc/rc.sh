echo pigshell $(uname -r)
cat /etc/motd
mount http://pigshell.com/v/$(uname -r)/usr/ /usr
if [ $? = true ]; then PATH=(/bin /usr/bin); fi
sh -s /etc/profile

if [ -f /local/rc.sh ]; then
    if [ $"norc = "" ]; then
        echo -n "Running /local/rc.sh... "
        sh -s /local/rc.sh
        if [ $? = true ]; then echo done; else echo failed; fi
    fi
fi
ish -N ish1

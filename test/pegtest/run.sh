#!/bin/bash

files="$*"
[ -z "$files" ] && files="syntest/* ../../js/root/bin/*"
pass=0
fail=0
dfail=0
for i in $files; do
    testname=$(basename $i)
    echo -n "$(printf "%-20s" $testname)"
    node pegtest.js $i >results/$testname 2>/dev/null
    if [ $? -ne 0 ]; then
        echo fail
        fail=$[fail+1]
    else
        if [ -f ref/$testname ]; then
            diff ref/$testname results/$testname >/dev/null 2>&1
            if [ $? -ne 0 ]; then
                echo fail diff
                dfail=$[dfail+1]
            else
                echo ok
                pass=$[pass+1]
            fi
        else
            echo ok
            pass=$[pass+1]
        fi
    fi
done
echo
echo "Pass: $pass Fail: $fail Diff failed: $dfail"

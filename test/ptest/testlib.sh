# expect val1 val2 testname [debug|abort]
function expect {
    if T $1 = $2; then
        _res=true
        printf -s "%-40s %s\n" $3 ok
    else
        _res=false
        if T $# -ge 4 && T $4 = "debug"; then
            printf -s "%-40s %s (expected:#%s# got: #%s#)\n" $3 fail $2 $1
        else
            printf -s "%-40s %s\n" $3 fail
        fi
        if T $# -ge 4 && T $4 = "abort"; then
            echo aborting
            exit 1
        fi
    fi
    return $_res
}

function dont_expect {
    if T $1 != $2; then
        _res=true
        printf -s "%-40s %s\n" $3 ok
    else
        _res=false
        printf -s "%-40s %s\n" $3 fail
        if T $# -ge 4 && T $4 = "abort"; then
            echo aborting
            exit 1
        fi
    fi
    return $_res
}

# cmp file1 file2
function cmp {
    if T $# -ne 2; then echo cmp needs 2 files; exit 1; fi
    size1=$(ls -d $1 | printf "%(size)s")
    size2=$(ls -d $2 | printf "%(size)s")
    if T $"size1 != $"size2; then
        return false
    else
        sum1=$(md5 $1)
        sum2=$(md5 $2)
        if T $sum1 != $sum2; then
            return false
        fi
    fi
    return true
}

function cmpdir {
    if [ $# -lt 2 ]; then echo cmpdir needs 2 directories; exit 1; fi
    cdir=$(pwd)
    cd $1
    if [ $? != true ]; then echo $1 invalid; exit 1; fi
    list1=$(ls -GR)
    cd $cdir; cd $2
    if [ $? != true ]; then echo $2 invalid; cd $cdir; exit 1; fi
    list2=$(ls -GR)
    cd $cdir
    if [ $"list1 != $"list2 ]; then 
        if [ $"3 = "debug" ]; then
            echo $1 ":"
            for i in $list1; do echo $i; done
            echo $2 ":"
            for i in $list2; do echo $i; done
        fi
        return false
    fi
        
    cd $1
    sum1=()
    for i in $list1; do
        if [ $(ls -d $i | jf 'isrealdir(x)') = false ]; then
            sum1=($sum1 $(echo $i $(md5 $i)))
        fi
    done
    cd $cdir; cd $2
    sum2=()
    for i in $list1; do
        if [ $(ls -d $i | jf 'isrealdir(x)') = false ]; then
            sum2=($sum2 $(echo $i $(md5 $i)))
        fi
    done
    cd $cdir
    if [ $"sum1 != $"sum2 ]; then
        if [ $"3 = "debug" ]; then
            echo $1 ":"
            for i in $sum1; do echo $i; done
            echo $2 ":"
            for i in $sum2; do echo $i; done
        fi
        return false
    else
        return true
    fi
}

TESTBASE=/home/test/ptest
TDIR=sample
TMPDIR=tmp
RESDIR=$TESTBASE/results
REFDIR=$TESTBASE/ref

function dcheck {
    e=$(expect $*)
    if T $? = true; then
        cmp $RESDIR/$3 $REFDIR/$3
        if T $? = false; then
            echo $e "(diff failed)"
            return false
        fi
    fi
    echo $e
}
# Testing testing
# expect 2 3 ff.3 abort
# expect 1 2 ff.1 debug
# expect 2 2 ff.2
# cmp /doc/README.md /doc/README.md
# expect $? true cmp.1
# cmp /doc/README.md /doc/pigshell.md
# expect $? false cmp.2

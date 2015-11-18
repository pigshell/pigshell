#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "cp tests started on" $(date)

SAMPLEDIR="/home/sample"

CHUNKSIZE=262144
COPTS="-o cp.chunksize="^$CHUNKSIZE
GDRIVEUSER1=$GDRIVEUSERS(0)
GDRIVEUSER2=$GDRIVEUSERS(1)
DEATHSTAR=1

TMP="/tmp/cptest"

# simplercp sourcedir targetdir checkdir num
function simplercp {
    cp -vr $COPTS $1 $2 2>$RESDIR/cp.$4.1
    dcheck $? true cp.$4.1
    cmpdir $1 $3 debug
    expect $? true cp.$4.2
}

# partcp sourcefile targetdir num
function partcp {
    cp -v -o range.off=0,range.len=1024 $1 $2 2>$RESDIR/cp.$3.1
    dcheck $? true cp.$3.1
    cp -vc -o range.off=1024,range.len=1024 $1 $2 2>$RESDIR/cp.$3.2
    dcheck $? true cp.$3.2
    cp -vc $COPTS $1 $2 2>$RESDIR/cp.$3.3
    dcheck $? true cp.$3.3
    cmp $1 $2
    expect $? true cp.$3.4
}

# bundle targetdir checkdir num
function bundletest {
    URL=$(uname -u)/sample/bundletest.html
    MNT_NOBDL=/tmp/nobundle

    mkdir $MNT_NOBDL 2>/dev/null
    umount $MNT_NOBDL 2>/dev/null

    cp -va $URL $1/bundletest 2>$RESDIR/cp.$3.1
    dcheck $? true cp.$3.1

    BURL=$(ls -d $1 | jf 'x.ident')
    mount -o $"4^bdlmime= $BURL $MNT_NOBDL
    cmpdir $2 $MNT_NOBDL/bundletest.bdl debug
    expect $? true cp.$3.2
    cat $1/bundletest | to text > $RESDIR/cp.$3.3
    dcheck $? true cp.$3.3

    mv $1/bundletest $1/bundletest2
    expect $? true cp.$3.4
    ls -F $MNT_NOBDL >/dev/null
    cmpdir $2 $MNT_NOBDL/bundletest2.bdl debug
    expect $? true cp.$3.5
    cat $1/bundletest2 | to text > $RESDIR/cp.$3.6
    dcheck $? true cp.$3.6

    rm $1/bundletest2
    expect $? true cp.$3.7
    ls -F $MNT_NOBDL >/dev/null
    [ -d $MNT_NOBDL/bundletest2.bdl ]
    dont_expect $? true cp.$3.8

}

function linktest {
    URL=$(uname -u)/sample/bundletest.html
    MNT_NOLINK=/tmp/nolink
    DEST=$1

    mkdir $MNT_NOLINK 2>/dev/null
    umount $MNT_NOLINK 2>/dev/null

    LURL=$(ls -d $DEST | jf 'x.ident')
    mount -o $"3^linkmime= $LURL $MNT_NOLINK

    link $SAMPLEDIR $DEST/samplelink
    expect $? true cp.$2.1
    cat $MNT_NOLINK/samplelink.href >$RESDIR/cp.$2.2
    dcheck $? true cp.$2.2
    cmpdir $SAMPLEDIR $DEST/samplelink 
    expect $? true cp.$2.3

    mkdir $DEST/linkdir1 $DEST/linkdir2 2>/dev/null

    link $SAMPLEDIR/* $DEST/linkdir1
    expect $? true cp.$2.4
    cmpdir $SAMPLEDIR $DEST/linkdir1 debug
    expect $? true cp.$2.5

    ls $SAMPLEDIR | link $DEST/linkdir2
    expect $? true cp.$2.6
    cmpdir $SAMPLEDIR $DEST/linkdir2 debug
    expect $? true cp.$2.7

    link $URL $DEST/ulink
    cat $DEST/ulink | to text > $RESDIR/cp.$2.8
    dcheck $? true cp.$2.8

    mv $DEST/ulink $DEST/ulink2
    expect $? true cp.$2.9
    ls -F $MNT_NOLINK >/dev/null
    [ -f $MNT_NOLINK/ulink2.href ]
    expect $? true cp.$2.10
    cat $DEST/ulink2 | to text > $RESDIR/cp.$2.11
    dcheck $? true cp.$2.11

    rm $DEST/ulink2
    expect $? true cp.$2.12
    ls -F $MNT_NOLINK >/dev/null
    [ -f $MNT_NOLINK/ulink2.href ]
    dont_expect $? true cp.$2.13

    rm -r $DEST/linkdir1
    expect $? true cp.$2.14
    [ -f $SAMPLEDIR/bundletest.html ]
    expect $? true cp.$2.15
}

function pstyfs_test {
    TMP0=$RESDIR/cptest
    TMP1=$TMP0/cptest1
    TMP2=$TMP0/cptest2
    TMP3=$TMP0/bundletest1
    TMP4=$TMP0/linktest1

    PSTYFS_URL=$(jf window.location.protocol 1)//localhost:50937/

    mkdir $TMP0 $TMP1 $TMP2 $TMP3 $TMP4 2>/dev/null
    rm -r $TMP1/*  2>/dev/null
    rm -r $TMP2/* 2>/dev/null
    rm -r $TMP3/* 2>/dev/null
    rm -r $TMP4/* 2>/dev/null

    simplercp $SAMPLEDIR/ $TMP1 $TMP1 pstyfs.slash
    simplercp $SAMPLEDIR $TMP2 $TMP2/sample pstyfs.noslash

    partcp $SAMPLEDIR/clickingofcuthbert.pdf $TMP0/clickingofcuthbert.pdf pstyfs.partcp

    bundletest $TMP3 $REFDIR/cptest/bundletest1/bundletest pstyfs.bundle
    linktest $TMP4 pstyfs.link
}

function ramfs_test {
    CPTMP=($TMP/cptest1 $TMP/cptest2 $TMP/bundletest1 $TMP/linktest1)

    rm -r $CPTMP 2>/dev/null
    mkdir $TMP $CPTMP

    # With trailing slash, should copy contents
    simplercp $SAMPLEDIR/ $CPTMP(0) $CPTMP(0) ramfs.slash
    # Without trailing slash, should copy directory as well
    simplercp $SAMPLEDIR $CPTMP(1) $CPTMP(1)/sample ramfs.noslash

    partcp $SAMPLEDIR/clickingofcuthbert.pdf $TMP/clickingofcuthbert.pdf ramfs.partcp

    bundletest $CPTMP(2) $REFDIR/cptest/bundletest1/bundletest ramfs.bundle
    linktest $CPTMP(3) ramfs.link
}

function dropbox_test {
    DTMP=/dropbox/$DROPBOXUSER/pigshell-test
    CPTMP=($DTMP/cptest1 $DTMP/bundletest1 $DTMP/linktest1)

    if ! [ -d $"DTMP ]; then echo "DROPBOXUSER not available; skipping"; return; fi

    rm -r $DTMP/* 2>/dev/null
    mkdir $CPTMP 2>/dev/null
    
    simplercp $SAMPLEDIR $CPTMP(0) $CPTMP(0)/sample dropbox.noslash
    bundletest $CPTMP(1) $REFDIR/cptest/bundletest1/bundletest dropbox.bundle user=$DROPBOXUSER,
    linktest $CPTMP(2) dropbox.link user=$DROPBOXUSER,
}

# GDrive as source
function gdrivefs_test {
    GDRIVESRC=/gdrive/$GDRIVEUSER1/pigshell-test
    GDRIVEDST=/gdrive/$GDRIVEUSER2/pigshell-test

    if ! [ -d $"GDRIVESRC ]; then echo "GDRIVEUSER1 not available; skipping"; return; fi
    TMP1=$TMP/cptest-gdrive
    mkdir $TMP1 2>/dev/null
    rm -r $TMP1/* 2>/dev/null

    rm -r $TMP1/sample 2>/dev/null
    cp -vr $COPTS $GDRIVESRC/sample $TMP1 2>$RESDIR/cp.gdrive.1
    dcheck $? true cp.gdrive.1
    cmpdir $SAMPLEDIR $TMP1/sample
    expect $? true cp.gdrive.2

    cp -vrc $COPTS $GDRIVESRC/sample $TMP1 2>$RESDIR/cp.gdrive.3
    dcheck $? true cp.gdrive.3

    rm -r $GDRIVESRC/target* 2>/dev/null
    mkdir $GDRIVESRC/target 2>/dev/null
    cp -vr $SAMPLEDIR $GDRIVESRC/target 2>$RESDIR/cp.gdrive.4
    dcheck $? true cp.gdrive.4

    # Copy files straight from one user to another
    if ! [ -d $"GDRIVEDST ]; then echo "GDRIVEUSER2 not available; skipping"; return; fi
    rm -r $GDRIVEDST/sample 2>/dev/null
    cp -vr $GDRIVESRC/sample $GDRIVEDST 2>$RESDIR/cp.gdrive.5
    dcheck $? true cp.gdrive.5
    cmpdir $SAMPLEDIR $GDRIVEDST/sample
    expect $? true cp.gdrive.6
}

function gdrivefs_doc_test {
    SRCDIR=$SAMPLEDIR/docs
    DSTDIR=/gdrive/$GDRIVEUSER1/pigshell-test
    DSTDIR2=/gdrive/$GDRIVEUSER2/pigshell-test
    TMP1=$TMP/cptest-gdrive
    TMP2=$TMP/cptest-gdrive/pdf

    if ! [ -d $"DSTDIR ]; then echo "GDRIVEUSER1 not available; skipping"; return; fi

    mkdir $TMP1 $TMP2 2>/dev/null

    # Upload docs to GDrive with conversion
    rm $DSTDIR/docs/* 2>/dev/null
    cp -vr -o gdrive.convert $SRCDIR $DSTDIR 2>$RESDIR/cp.gdoc.1
    dcheck $? true cp.gdoc.1

    # Download docs back
    rm $TMP1/docs/* 2>/dev/null
    cp -vr $DSTDIR/docs $TMP1 2>$RESDIR/cp.gdoc.2
    dcheck $? true cp.gdoc.2
    # Verify manually

    # With -c, we should get nothing
    cp -vrc $DSTDIR/docs $TMP1 2>$RESDIR/cp.gdoc.3
    dcheck $? true cp.gdoc.3

    # Download as pdf
    rm $TMP2/* 2>/dev/null
    cp -vr -o gdrive.fmt=pdf $DSTDIR/docs $TMP2 2>$RESDIR/cp.gdoc.4
    dcheck $? true cp.gdoc.4
    # Verify manually

    # Copy docs straight from one user to another
    if ! [ -d $"DSTDIR2 ]; then echo "GDRIVEUSER2 not available; skipping"; return; fi
    rm $DSTDIR2/sampledocs/* 2>/dev/null
    cp -vr -o gdrive.convert $DSTDIR/docs $DSTDIR2 2>$RESDIR/cp.gdoc.5
    dcheck $? true cp.gdoc.5
    # Verify manually

}

ramfs_test
pstyfs_test
gdrivefs_test
#gdrivefs_doc_test
dropbox_test

#!pigshell

# Tests for URI parsing

sh -s testlib.sh
echo "uri tests started on" $(date)

URLS=<<EOH
http://user1:pass1@foo.bar:8080/a/b/c?q1=1&q2=2#frag1=v1,frag2=v2
http://foo.com
https://foo.bar:443/path/to/file.html
https://foo.bar:8080/path/to/file/?q1=1&q2=2#frag1=v1,frag2=v2
//foo.com/bar?q1=1&q2=2#frag1=v1
foo/bar?q1=1&q2=2#frag1=v1
/
../
../../../../
https://picasaweb.google.com/data/entry/api/user/357345893/albumid/457248754387#user=foo.bar@gmail.com
https://user1:pass1@picasaweb.google.com:8080/data/entry/api/user/357345893/albumid/457248754387?q1=1&q2=2#user=foo.bar@gmail.com
ramfs://root/data/entry/api/user/357345893/albumid/457248754387#user=foo.bar@gmail.com
ramfs://root/data/entry/api/user/357345893/albumid/457248754387?q1=1&q2=2#user=foo.bar@gmail.com
EOH

t=0
for i in $(echo -n $URLS | to lines); do
    t=$(E $t + 1)
    sh -c "echo $i | jf 'URI.parse(x.trim()).parts' | printf" >$RESDIR/uri.$t
    dcheck $? true uri.$t
done

jf 'URI.parse("http://www.freebsd.org").resolve(URI.parse("."))' 1 >$RESDIR/uri.resolve.1
dcheck $? true uri.resolve.1
jf 'URI.parse("http://www.freebsd.org").resolve(URI.parse("./"))' 1 >$RESDIR/uri.resolve.2
dcheck $? true uri.resolve.2
jf 'URI.parse("http://www.freebsd.org").resolve(URI.parse("./foo/bar/baz.html"))' 1 >$RESDIR/uri.resolve.3
dcheck $? true uri.resolve.3
jf 'URI.parse("http://www.freebsd.org/").resolve(URI.parse("."))' 1 >$RESDIR/uri.resolve.4
dcheck $? true uri.resolve.4
jf 'URI.parse("http://www.freebsd.org/").resolve(URI.parse("./"))' 1 >$RESDIR/uri.resolve.5
dcheck $? true uri.resolve.5
jf 'URI.parse("https://www.kernel.org/pub/").resolve(URI.parse("dist/"))' 1 >$RESDIR/uri.resolve.6
dcheck $? true uri.resolve.6

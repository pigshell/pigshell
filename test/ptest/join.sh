#!pigshell

# Tests for join

sh -s testlib.sh

a=${cat http://pigshell.com/sample/life-expectancy.html | table2js -e "tr" foo name years | jf 'x.name = x.name.trim(), x' | sort -f name}
b=${cat /usr/share/misc/countries.json | to text | jf 'JSON.parse(x)'|sort -f name}

join -s -e "x.name === y.name ? 0 : x.name < y.name ? -1 : 1" $a $b | jf 'x.manyears = Math.round(x.population * +x.years), x' | printf "%(name)-20s %(years)15s %(population)15s %(manyears)15s\n" >$RESDIR/join.1
dcheck $? true join.1

a=${cat http://pigshell.com/sample/life-expectancy.html | table2js -e "tr" foo name years | jf 'x.name = x.name.trim(), x'}
b=${cat /usr/share/misc/countries.json | to text | jf 'JSON.parse(x)'}


join -e "x.name === y.name" $a $b | jf 'x.manyears = Math.round(x.population * +x.years), x' | printf "%(name)-20s %(years)15s %(population)15s %(manyears)15s\n" >$RESDIR/join.2
dcheck $? true join.2

a=${cat http://pigshell.com/sample/life-expectancy.html | table2js -e "tr" foo name years | jf 'x.name = x.name.trim(), x' | sort -f name}
b=${cat /usr/share/misc/countries.json | to text | jf 'JSON.parse(x)'|sort -f name}

join -s -f name $a $b | jf 'x.manyears = Math.round(x.population * +x.years), x' | printf "%(name)-20s %(years)15s %(population)15s %(manyears)15s\n" >$RESDIR/join.3
dcheck $? true join.3

a=${cat http://pigshell.com/sample/life-expectancy.html | table2js -e "tr" foo name years | jf 'x.name = x.name.trim(), x'}
b=${cat /usr/share/misc/countries.json | to text | jf 'JSON.parse(x)'}


join -f name $a $b | jf 'x.manyears = Math.round(x.population * +x.years), x' | printf "%(name)-20s %(years)15s %(population)15s %(manyears)15s\n" >$RESDIR/join.4
dcheck $? true join.4

cat $RESDIR/join.4 | to lines | sort > $RESDIR/join.5
dcheck $? true join.5

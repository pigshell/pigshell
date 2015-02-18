#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "hgrep tests started on" $(date)

HTML=<<EOH
<h1>Heading!</h1>
<h2>Smaller heading 1</h2>
<p class="warning">
    <a href="http://foo.bar.com/warning.html">Warning warning!</a>
</p>
<h2 class="foo">Smaller heading 2</h2>
<p class="warning">Another paragraph</p>
<table>
    <th>
        <td>No.</td>
        <td>Name</td>
        <td>Earnings</td>
        <td>URL</td>
    </th>
    <tr>
        <td>  1  </td>
        <td>
        Foo Bar</td>
        <td> INR 345,000.04 </td>
        <td>
            <a href="http:/foo.bar.com/follow/1">Follow user</a>
            <a href="http:/foo.bar.com/mute/1">Mute user</a>
        </td>
    </tr>
    <tr>
        <td> 2 </td>
        <td>Able Baker</td>
        <td>$-55.67</td>
        <td>
            <a href="http:/foo.bar.com/follow/2">Follow user</a>
            <a href="http:/foo.bar.com/mute/2">Mute user</a>
        </td>
    </tr>
    <tr>
        <td> +3 </td>
        <td>Able Baker</td>
        <td>-55.67</td>
        <td>
            <a href="http:/foo.bar.com/follow/3">Follow user</a>
            <a href="http:/foo.bar.com/mute/3">Mute user</a>
        </td>
    </tr>
</table>
<h2 class="bar">Smaller heading 3</h2>
<p class="warning">Yet another</p>
<p>Classless para</p>
<table>
    <tr>
        <td>Copyright</td>
        <td>Yoyodyne Systems</td>
        <td><span>1234</span>2014</td>
    </tr>
</table>
EOH

# All tables
dtest hgrep.1 "echo $HTML | hgrep table"

# All table rows
dtest hgrep.2 "echo $HTML | hgrep tr"

# All table rows which contain at least one <td> whose text contains "Able"
dtest hgrep.3 "echo $HTML | hgrep tr 'td:contains(Able)'"

# All table rows which have a descendant <a> whose href attribute contains '3'
dtest hgrep.4 "echo $HTML | hgrep tr 'a[href*=3]'"

# All table data which have a descendant <a> whose href attribute contains '3'
dtest hgrep.5 "echo $HTML | hgrep td 'a[href*=3]'"

# All tables which have a descendant <a> whose href attribute contains '3'
dtest hgrep.6 "echo $HTML | hgrep table 'a[href*=3]'"

# Paragraph with class warning and containing text 'para'
dtest hgrep.7 "echo $HTML | hgrep 'p.warning:contains(para)'"

# Address elements whose text contains 'Follow'
dtest hgrep.8 "echo $HTML | hgrep 'a:contains(Follow)'"

# href attributes of all <a> elements
dtest hgrep.9 "echo $HTML | hgrep -a href a | printf '%s\\n' "

# href attributes of all <a> elements whose text contains 'Follow'
dtest hgrep.10 "echo $HTML | hgrep -a href 'a:contains(Follow)' | printf '%s\\n' "
# Text content of all <a> elements whose text contains 'Follow'
dtest hgrep.11 "echo $HTML | hgrep -t 'a:contains(Follow)' | printf '%s\\n' "

# First (indexing starts from 0) <a> element
dtest hgrep.12 "echo $HTML | hgrep -r 0 a"

# Last (negative indices start from the end) table row
dtest hgrep.13 "echo $HTML | hgrep -r -1 tr"

# Slice 0:2 of table rows (first and second <tr> elements)
dtest hgrep.14 "echo $HTML | hgrep -r 0:2 tr"

# Last row of first table
dtest hgrep.15 "echo $HTML | hgrep -r 0 table | hgrep -r -1 tr"

# Remove spans
dtest hgrep.16 "echo $HTML | hgrep -v 'td span'"

# Remove table rows whose data contains 'INR'
dtest hgrep.17 "echo $HTML | hgrep -v tr 'td:contains(INR)'"

# Last 2 table rows
dtest hgrep.18 "echo $HTML | hgrep -r -2: tr"

# Penultimate table row
dtest hgrep.19 "echo $HTML | hgrep -r -2:-1 tr"

# 2nd row onwards
dtest hgrep.20 "echo $HTML | hgrep -r 1: tr"

# Strip 1st,2nd column of first table
dtest hgrep.21 "echo $HTML | hgrep -r 0 table | hgrep -v 'td:nth-child(-n+2)'"

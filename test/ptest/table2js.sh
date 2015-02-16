#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "table2js tests started on" $(date)

TABLE1=<<EOH
<table>
    <th>
        <td>No.</td>
        <td>Name</td>
        <td>Earnings</td>
    </th>
    <tr>
        <td>  1  </td>
        <td>
        Foo Bar</td>
        <td> INR 345,000.04 </td>
    </tr>
    <tr>
        <td> 2 </td>
        <td>Able Baker</td>
        <td>$-55.67</td>
    </tr>
    <tr>
        <td> +3 </td>
        <td>Able Baker</td>
        <td>-55.67</td>
    </tr>
</table>
EOH

dtest table2js.1 "echo $TABLE1 | table2js | printf"
dtest table2js.2 "echo $TABLE1 | table2js -r no name| printf"
dtest table2js.3 "echo $TABLE1 | table2js no name earn| printf"
dtest table2js.4 "echo $TABLE1 | table2js -c '\$|INR' | printf"

#!pigshell

# Tests for cut, rename, reshape

sh -s testlib.sh
echo "csv tests started on" $(date)

CSV=southasia.csv

objs=$(cat $CSV | csv2js)

dtest cut.1 "echo $objs | cut -f AFG,IND,MDV | printf"
dtest cut.2 "echo $objs | cut -f ${echo -r AFG IND MDV} | printf"

dtest rename.1 "echo $objs | rename -f Date,AFG,BGD -t date,af,bg | printf"
dtest rename.2 "echo $objs | rename -f ${echo -r Date AFG BGD} -t ${echo -r date af bg} | printf"
dtest rename.3 "echo $objs | rename -f Date,AFG,BGD -t ${echo -r date af bg} | printf"
dtest rename.4 "echo $objs | rename -f ${echo -r Date AFG BGD} -t date,af,bg | printf"

dtest reshape.1 "echo $objs | reshape -r Date -f country -v data | printf"
dtest reshape.2 "echo $objs | reshape -c AFG,BGD,BTN,IND,LKA,MDV,NPL,PAK -f country -v data | printf"

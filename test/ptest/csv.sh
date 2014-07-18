#!pigshell

# Tests for cut, rename, reshape

sh -s testlib.sh

CSV=southasia.csv

objs=$(cat $CSV | csv2js)

echo $objs | cut -f AFG,IND,MDV | printf -j >$RESDIR/cut.1
dcheck $? true cut.1
echo $objs | cut -f ${echo -r AFG IND MDV} | printf -j >$RESDIR/cut.2
dcheck $? true cut.2

echo $objs | rename -f Date,AFG,BGD -t date,af,bg | printf -j >$RESDIR/rename.1
dcheck $? true rename.1
echo $objs | rename -f ${echo -r Date AFG BGD} -t ${echo -r date af bg} | printf -j >$RESDIR/rename.2
dcheck $? true rename.2
echo $objs | rename -f Date,AFG,BGD -t ${echo -r date af bg} | printf -j >$RESDIR/rename.3
dcheck $? true rename.3
echo $objs | rename -f ${echo -r Date AFG BGD} -t date,af,bg | printf -j >$RESDIR/rename.4
dcheck $? true rename.4

echo $objs | reshape -r Date -f country -v data | printf -j >$RESDIR/reshape.1
dcheck $? true reshape.1
echo $objs | reshape -c "AFG,BGD,BTN,IND,LKA,MDV,NPL,PAK" -f country -v data | printf -j >$RESDIR/reshape.2
dcheck $? true reshape.2

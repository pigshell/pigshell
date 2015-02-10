#!pigshell

sh -s testlib.sh
sh -s config.sh
echo "T tests started on" $(date)

TESTFILE="/tmp/Ttest.1"

T -a /
expect $? true T.1
T -a /adasda
dont_expect $? true T.2

T -f /
dont_expect $? true T.3
T -f /adasda
dont_expect $? true T.4
echo foo >$TESTFILE
T -f $TESTFILE
expect $? true T.5

T -d /
expect $? true T.6
T -d /adasda
dont_expect $? true T.7
T -d $TESTFILE
dont_expect $? true T.8

T -r $TESTFILE
expect $? true T.9

T -w $TESTFILE
expect $? true T.10

T -z ""
expect $? true T.11
T -z "asd"
dont_expect $? true T.12
T -z $"nonexistent
expect $? true T.13

T -n $"nonexistent
dont_expect $? true T.14
T -n ""
dont_expect $? true T.15
T -n "asd"
expect $? true T.16

T astring = astring
expect $? true T.17
T astring = bstring
dont_expect $? true T.18
T astring = ""
dont_expect $? true T.19
T " " = "  "
dont_expect $? true T.20

T astring != astring
dont_expect $? true T.21
T astring != bstring
expect $? true T.22
T astring != ""
expect $? true T.23
T " " != "  "
expect $? true T.24

T astring '<' bstring
expect $? true T.25
T bstring '<' bstring
dont_expect $? true T.26
T bstring '<' bstr
dont_expect $? true T.27
T bstring '<' bstring5
expect $? true T.28

T astring '>' bstring
dont_expect $? true T.29
T bstring '>' bstring
dont_expect $? true T.30
T bstring '>' bstr
expect $? true T.31
T bstring '>' bstring5
dont_expect $? true T.32

T 0 -eq 0
expect $? true T.33
T 234 -eq 234
expect $? true T.34
T -113 -eq -113
expect $? true T.35
T 114.5 -eq 114.5
expect $? true T.36
T 114.5 -eq 114.51
dont_expect $? true T.37
T 234 -eq 23
dont_expect $? true T.38

T 0 -ne 0
dont_expect $? true T.39
T -11 -ne -11
dont_expect $? true T.40
T 12 -ne 13
expect $? true T.41
T 13 -ne 12
expect $? true T.42
T 114.51 -ne 114.5
expect $? true T.43
T 114.51 -ne 115.51
expect $? true T.44

T 0 -lt 0
dont_expect $? true T.45
T 4 -lt 5
expect $? true T.46
T 5 -lt 4
dont_expect $? true T.47
T 114.5 -lt 114.51
expect $? true T.48

T 0 -gt 0
dont_expect $? true T.49
T 4 -gt 5
dont_expect $? true T.50
T 5 -gt 4
expect $? true T.51
T 114.5 -gt 114.51
dont_expect $? true T.52

T 0 -ge 0
expect $? true T.43
T 4 -ge 5
dont_expect $? true T.54
T 5 -ge 4
expect $? true T.55
T 114.5 -ge 114.51
dont_expect $? true T.56

T 0 -le 0
expect $? true T.57
T 4 -le 5
expect $? true T.58
T 5 -le 4
dont_expect $? true T.59
T 114.5 -le 114.51
expect $? true T.60

T '1 + 1 === 2'
expect $? true T.61
T '1 + 1 === 3'
dont_expect $? true T.62

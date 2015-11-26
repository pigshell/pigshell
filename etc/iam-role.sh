#!/bin/bash

# Creates an IAM role and inline policy for the user identified by a given
# "Login with Amazon" id and allows this user - when using pigshell - to access
# all S3 operations owned by whoever runs this command with a working aws CLI
# setup.
#
# awscli must be installed and configured with id and secret access # key. "pip
# install awscli", followed by "aws configure"

function usage {
    cat <<EOH
Usage:
$0 create <amazon_id>
$0 delete
EOH
    exit 1
}

ROLENAME="pigshell-me2"
POLICYNAME=$ROLENAME-s3

cmd=$1

if [ "$cmd" = "delete" ]; then
    aws iam delete-role-policy --role-name $ROLENAME --policy-name $POLICYNAME
    aws iam delete-role --role-name $ROLENAME
    exit $?
fi
[ "$cmd" != "create" ] && usage
AMZNID=$2
[ -z "$AMZNID" ] && usage

ROLESTR=$(cat <<EOH
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "www.amazon.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "www.amazon.com:app_id": "amzn1.application.990b550877e24a258b32e400b6e53304",
          "www.amazon.com:user_id": "$AMZNID"
        }
      }
    }
  ]
}
EOH
)

POLICYSTR=$(cat <<EOH
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        }
    ]
}
EOH
)

IAMOUT=$(echo "$ROLESTR" | aws iam create-role --role-name $ROLENAME --assume-role-policy-document file:///dev/stdin)
ARN=$(echo "$IAMOUT" | grep -o 'arn:aws:[^"]*')
if [ -z "$ARN" ]; then echo No $ARN found in "$IAMOUT"; exit 1; fi
echo "$POLICYSTR" | aws iam put-role-policy --role-name $ROLENAME --policy-name $POLICYNAME --policy-document file:///dev/stdin
if [ $? -eq 0 ]; then echo $ARN; exit 0; fi
exit 1

#!/bin/bash
set -euo pipefail

BUCKET="lifeadmin-$(openssl rand -hex 4)"
REGION="eu-west-2"

echo "Creating S3 bucket: $BUCKET"
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-ownership-controls \
  --bucket "$BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

echo "Creating CloudFront Origin Access Control"
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config \
    Name=lifeadmin-oac,Description="OAC for LifeAdmin",OriginAccessControlOriginType=s3,SigningBehavior=always,SigningProtocol=sigv4 \
  --query 'OriginAccessControl.Id' \
  --output text)

echo "Creating CloudFront distribution"
DIST_CONFIG=$(cat <<EOF
{
  "CallerReference": "lifeadmin-$(date +%s)",
  "Aliases": { "Quantity": 0 },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "lifeadmin-s3-origin",
        "DomainName": "$BUCKET.s3.$REGION.amazonaws.com",
        "OriginAccessControlId": "$OAC_ID",
        "S3OriginConfig": { "OriginAccessIdentity": "" }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "lifeadmin-s3-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  "CacheBehaviors": { "Quantity": 0 },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      { "ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0 },
      { "ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0 }
    ]
  },
  "Comment": "LifeAdmin static site",
  "Enabled": true,
  "IsIPV6Enabled": true,
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": { "CloudFrontDefaultCertificate": true },
  "Restrictions": { "GeoRestriction": { "RestrictionType": "none", "Quantity": 0 } }
}
EOF
)

DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config "$DIST_CONFIG" \
  --query 'Distribution.Id' \
  --output text)

echo "Waiting for distribution to deploy..."
aws cloudfront wait distribution-deployed --id "$DIST_ID"

DIST_DOMAIN=$(aws cloudfront get-distribution \
  --id "$DIST_ID" \
  --query 'Distribution.DomainName' \
  --output text)

echo "Setting bucket policy for CloudFront access"
POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$AWS_ACCOUNT:distribution/$DIST_ID"
        }
      }
    }
  ]
}
EOF
)

aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY"

echo "Uploading static files..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"

aws s3 sync "$SOURCE_DIR" s3://"$BUCKET" \
  --exclude ".git/*" \
  --exclude "terraform/*" \
  --exclude "scripts/*" \
  --exclude ".gitignore" \
  --exclude "*.md" \
  --exclude ".DS_Store"

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "CloudFront URL: https://$DIST_DOMAIN"
echo "S3 Bucket: $BUCKET"
echo "Distribution ID: $DIST_ID"
echo ""
echo "Note: It may take a few minutes for CloudFront to propagate."
echo "=========================================="

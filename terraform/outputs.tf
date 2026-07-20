output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "s3_bucket" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.site.bucket
}

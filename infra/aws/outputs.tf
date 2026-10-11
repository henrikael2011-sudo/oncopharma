output "public_urls" {
  description = "URLs públicas dos apps (registrar como redirect URI/post-logout no IdP: <url>/api/auth/callback e <url>/)."
  value       = { for k, v in local.public_services : k => "https://${local.fqdn[k]}" }
}

output "api_internal_url" {
  value = "https://${local.api_fqdn}"
}

output "alb_public_dns" {
  value = aws_lb.public.dns_name
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "rds_master_secret_arn" {
  description = "Segredo da senha mestre gerenciado pelo RDS (uso só administrativo)."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "secret_arns" {
  value = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.svc : k => r.repository_url }
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "acm_validation_records" {
  description = "Se route53_zone_id estiver vazio, criar estes CNAMEs manualmente no DNS."
  value       = [for o in aws_acm_certificate.main.domain_validation_options : { name = o.resource_record_name, type = o.resource_record_type, value = o.resource_record_value }]
}

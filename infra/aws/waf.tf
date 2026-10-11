# WAF regional no ALB público: regras gerenciadas AWS, limite de taxa por IP e Admin restrito a CIDRs institucionais.
resource "aws_wafv2_ip_set" "admin" {
  name               = "${local.name}-admin-allow"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = var.admin_allowed_cidrs
}

resource "aws_wafv2_web_acl" "public" {
  name  = "${local.name}-public"
  scope = "REGIONAL"
  default_action {
    allow {}
  }

  rule {
    name     = "admin-somente-rede-institucional"
    priority = 0
    action {
      block {}
    }
    statement {
      and_statement {
        statement {
          byte_match_statement {
            search_string         = local.fqdn["admin-web"]
            positional_constraint = "EXACTLY"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          not_statement {
            statement {
              ip_set_reference_statement {
                arn = aws_wafv2_ip_set.admin.arn
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "admin-block"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-ip"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 10
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAmazonIpReputationList"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 11
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 12
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 13
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # IPs anônimos (Tor/proxies) bloqueados; provedores de hospedagem apenas contados (evita bloquear pacientes em redes corporativas/VPN).
  rule {
    name     = "AWSManagedRulesAnonymousIpList"
    priority = 14
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
        rule_action_override {
          name = "HostingProviderIPList"
          action_to_use {
            count {}
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAnonymousIpList"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-public"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "public" {
  resource_arn = aws_lb.public.arn
  web_acl_arn  = aws_wafv2_web_acl.public.arn
}

# Nome deve começar com aws-waf-logs-. Cabeçalhos com credenciais são mascarados.
resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${local.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_wafv2_web_acl_logging_configuration" "public" {
  resource_arn            = aws_wafv2_web_acl.public.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }
  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

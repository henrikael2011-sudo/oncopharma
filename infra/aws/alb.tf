# ALB público (Care, Clinical, Admin) e ALB interno (API). TLS 1.2+/1.3 com certificado ACM.
# A API NÃO é exposta à internet: os apps (BFF) chamam https://api.internal.<domínio> pelo ALB interno.
locals {
  internal_domain = "internal.${var.domain_name}"
  api_fqdn        = "api.${local.internal_domain}"
  cert_sans       = concat([for k, v in local.public_services : local.fqdn[k]], [local.api_fqdn])
  certificate_arn = var.route53_zone_id != "" ? aws_acm_certificate_validation.main[0].certificate_arn : aws_acm_certificate.main.arn
  tls_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

resource "aws_acm_certificate" "main" {
  domain_name               = local.cert_sans[0]
  subject_alternative_names = slice(local.cert_sans, 1, length(local.cert_sans))
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = var.route53_zone_id == "" ? {} : {
    for o in aws_acm_certificate.main.domain_validation_options : o.domain_name => o
  }
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "main" {
  count                   = var.route53_zone_id == "" ? 0 : 1
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# ---------- Security groups (regras separadas para evitar ciclos) ----------
resource "aws_security_group" "alb_public" {
  name        = "${local.name}-alb-public"
  description = "ALB publico: HTTPS da internet (protegido por WAF)"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "alb_public_https" {
  security_group_id = aws_security_group.alb_public.id
  description       = "HTTPS publico"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_public_http" {
  #checkov:skip=CKV_AWS_260:Porta 80 apenas responde 301 para HTTPS (listener public_http).
  security_group_id = aws_security_group.alb_public.id
  description       = "HTTP apenas para redirecionar a HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_public_to_tasks" {
  for_each                     = local.public_services
  security_group_id            = aws_security_group.alb_public.id
  description                  = "Para ${each.key}"
  referenced_security_group_id = aws_security_group.tasks.id
  from_port                    = each.value.port
  to_port                      = each.value.port
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "alb_internal" {
  name        = "${local.name}-alb-internal"
  description = "ALB interno da API: somente a partir das tarefas"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "alb_internal_https" {
  security_group_id            = aws_security_group.alb_internal.id
  description                  = "HTTPS a partir das tarefas"
  referenced_security_group_id = aws_security_group.tasks.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_internal_to_api" {
  security_group_id            = aws_security_group.alb_internal.id
  description                  = "Para a API"
  referenced_security_group_id = aws_security_group.tasks.id
  from_port                    = var.services["api"].port
  to_port                      = var.services["api"].port
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks"
  description = "Tarefas ECS Fargate"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "tasks_from_public_alb" {
  for_each                     = local.public_services
  security_group_id            = aws_security_group.tasks.id
  description                  = "${each.key} a partir do ALB publico"
  referenced_security_group_id = aws_security_group.alb_public.id
  from_port                    = each.value.port
  to_port                      = each.value.port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "tasks_from_internal_alb" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "API a partir do ALB interno"
  referenced_security_group_id = aws_security_group.alb_internal.id
  from_port                    = var.services["api"].port
  to_port                      = var.services["api"].port
  ip_protocol                  = "tcp"
}

# Saída HTTPS (IdP institucional, endpoints AWS) e PostgreSQL. Sem outras portas.
resource "aws_vpc_security_group_egress_rule" "tasks_https" {
  security_group_id = aws_security_group.tasks.id
  description       = "HTTPS de saida (IdP OIDC, ALB interno, servicos AWS)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "tasks_db" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "PostgreSQL"
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# ---------- ALB público ----------
resource "aws_lb" "public" {
  name                       = "${local.name}-public"
  load_balancer_type         = "application"
  internal                   = false
  security_groups            = [aws_security_group.alb_public.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = true
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }
  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "svc" {
  #checkov:skip=CKV_AWS_378:TLS termina no ALB; alvos em sub-redes privadas sem rota de entrada. TLS ponta a ponta fica como evolução (README).
  for_each             = var.services
  name                 = substr("${local.name}-${each.key}", 0, 32)
  port                 = each.value.port
  protocol             = "HTTP" # TLS termina no ALB; tráfego interno na VPC privada (ver README: TLS ponta a ponta opcional)
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30
  health_check {
    path                = each.value.health_path
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "public_http" {
  #checkov:skip=CKV_AWS_2:Listener HTTP só redireciona para HTTPS.
  #checkov:skip=CKV_AWS_103:Listener HTTP só redireciona; TLS 1.2+ no listener 443.
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "public_https" {
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = local.tls_policy
  certificate_arn   = local.certificate_arn
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "public_host" {
  for_each     = local.public_services
  listener_arn = aws_lb_listener.public_https.arn
  priority     = 10 + index(keys(local.public_services), each.key)
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.svc[each.key].arn
  }
  condition {
    host_header {
      values = [local.fqdn[each.key]]
    }
  }
}

# ---------- ALB interno (API) ----------
resource "aws_lb" "internal" {
  name                       = "${local.name}-internal"
  load_balancer_type         = "application"
  internal                   = true
  security_groups            = [aws_security_group.alb_internal.id]
  subnets                    = aws_subnet.app[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = true
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }
  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_listener" "internal_https" {
  load_balancer_arn = aws_lb.internal.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = local.tls_policy
  certificate_arn   = local.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.svc["api"].arn
  }
}

# ---------- DNS ----------
resource "aws_route53_zone" "internal" {
  name = local.internal_domain
  vpc {
    vpc_id = aws_vpc.main.id
  }
}

resource "aws_route53_record" "api_internal" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = local.api_fqdn
  type    = "A"
  alias {
    name                   = aws_lb.internal.dns_name
    zone_id                = aws_lb.internal.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "public" {
  for_each = var.route53_zone_id == "" ? {} : local.public_services
  zone_id  = var.route53_zone_id
  name     = local.fqdn[each.key]
  type     = "A"
  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}

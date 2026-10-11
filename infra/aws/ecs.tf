# ECS Fargate: api, care-web, clinical-web, admin-web em sub-redes privadas, sem IP público.
locals {
  oidc_env_names = ["OIDC_ISSUER", "OIDC_AUTHORIZATION_ENDPOINT", "OIDC_TOKEN_ENDPOINT", "OIDC_JWKS_URI", "OIDC_AUDIENCE",
    "OIDC_CLIENT_ID", "OIDC_END_SESSION_ENDPOINT", "OIDC_SCOPE", "OIDC_SUBJECT_CLAIM", "OIDC_MFA_AMR", "OIDC_MFA_ACR",
  "OIDC_MFA_ACRS", "OIDC_ACRS_REQUEST", "AUTH_POST_LOGIN_PATH"]
  service_secrets = {
    api          = { DATABASE_URL = "app_db_url" }
    care-web     = { SESSION_ENCRYPTION_KEY = "care_session_key", OIDC_CLIENT_SECRET = "care_oidc_client" }
    clinical-web = { SESSION_ENCRYPTION_KEY = "clinical_session_key", OIDC_CLIENT_SECRET = "clinical_oidc_client" }
    admin-web    = { SESSION_ENCRYPTION_KEY = "admin_session_key", OIDC_CLIENT_SECRET = "admin_oidc_client" }
  }
  service_env = {
    for k, v in var.services : k => merge(
      { NODE_ENV = "production", PORT = tostring(v.port) },
      v.public ? { PORTAL_ORIGIN = "https://${local.fqdn[k]}", API_INTERNAL_URL = "https://${local.api_fqdn}" } : {},
      { for n, val in lookup(var.oidc_settings, k, {}) : n => val if contains(local.oidc_env_names, n) && val != "" }
    )
  }
}

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecr_repository" "svc" {
  for_each             = var.services
  name                 = "${var.project}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }
}

resource "aws_ecr_lifecycle_policy" "svc" {
  for_each   = aws_ecr_repository.svc
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Manter as 30 imagens mais recentes"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 30 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "svc" {
  for_each          = var.services
  name              = "/${var.project}/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execution role: puxar imagem, gravar logs e ler APENAS os segredos do próprio serviço.
resource "aws_iam_role" "execution" {
  for_each           = var.services
  name               = "${local.name}-${each.key}-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  for_each   = var.services
  role       = aws_iam_role.execution[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  for_each = var.services
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for s in values(local.service_secrets[each.key]) : aws_secretsmanager_secret.app[s].arn]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  for_each = var.services
  name     = "read-own-secrets"
  role     = aws_iam_role.execution[each.key].id
  policy   = data.aws_iam_policy_document.execution_secrets[each.key].json
}

# Task role: sem permissões AWS (a aplicação não chama APIs AWS no momento).
resource "aws_iam_role" "task" {
  for_each           = var.services
  name               = "${local.name}-${each.key}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_ecs_task_definition" "svc" {
  for_each                 = var.services
  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution[each.key].arn
  task_role_arn            = aws_iam_role.task[each.key].arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode([{
    name                   = each.key
    image                  = "${aws_ecr_repository.svc[each.key].repository_url}:${var.image_tag}"
    essential              = true
    readonlyRootFilesystem = each.key == "api"
    user                   = "1000:1000"
    portMappings           = [{ containerPort = each.value.port, protocol = "tcp" }]
    environment            = [for n, v in local.service_env[each.key] : { name = n, value = v }]
    secrets                = [for n, s in local.service_secrets[each.key] : { name = n, valueFrom = aws_secretsmanager_secret.app[s].arn }]
    linuxParameters        = { initProcessEnabled = true }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.svc[each.key].name
        awslogs-region        = var.region
        awslogs-stream-prefix = each.key
      }
    }
  }])
}

resource "aws_ecs_service" "svc" {
  for_each               = var.services
  name                   = each.key
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.svc[each.key].arn
  desired_count          = each.value.desired_count
  launch_type            = "FARGATE"
  platform_version       = "LATEST"
  enable_execute_command = false
  propagate_tags         = "SERVICE"
  network_configuration {
    subnets          = aws_subnet.app[*].id
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.svc[each.key].arn
    container_name   = each.key
    container_port   = each.value.port
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  depends_on = [aws_lb_listener.public_https, aws_lb_listener.internal_https]
}

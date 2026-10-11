# PostgreSQL 17 Multi-AZ, criptografado com KMS, sem acesso público, backups automáticos (PITR), TLS obrigatório.
# Senha mestre gerenciada pelo próprio RDS no Secrets Manager (não passa pelo estado do Terraform).
# A role de execução oncopharma_app (sem SUPERUSER/BYPASSRLS) é criada por infra/scripts/provision-app-role.sh
# a partir de uma tarefa administrativa dentro da VPC — nunca pela API.
resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.db[*].id
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "PostgreSQL acessivel apenas pelas tarefas ECS"
  vpc_id      = aws_vpc.main.id
  ingress {
    description     = "PostgreSQL a partir das tarefas ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.tasks.id]
  }
}

resource "aws_db_parameter_group" "pg17" {
  name   = "${local.name}-pg17"
  family = "postgres17"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  # Não registrar valores de parâmetros (poderiam conter dados pessoais).
  parameter {
    name  = "log_statement"
    value = "ddl"
  }
}

data "aws_iam_policy_document" "rds_monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name               = "${local.name}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume.json
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance" "main" {
  identifier                            = local.name
  engine                                = "postgres"
  engine_version                        = "17"
  instance_class                        = var.db_instance_class
  db_name                               = "oncopharma"
  username                              = "oncopharma_admin"
  manage_master_user_password           = true
  master_user_secret_kms_key_id         = aws_kms_key.main.arn
  allocated_storage                     = var.db_allocated_storage_gb
  max_allocated_storage                 = var.db_max_allocated_storage_gb
  storage_type                          = "gp3"
  storage_encrypted                     = true
  kms_key_id                            = aws_kms_key.main.arn
  multi_az                              = var.db_multi_az
  publicly_accessible                   = false
  db_subnet_group_name                  = aws_db_subnet_group.main.name
  vpc_security_group_ids                = [aws_security_group.db.id]
  parameter_group_name                  = aws_db_parameter_group.pg17.name
  backup_retention_period               = var.db_backup_retention_days
  backup_window                         = "05:00-06:00"         # UTC (02:00–03:00 BRT)
  maintenance_window                    = "sun:06:30-sun:07:30" # UTC
  copy_tags_to_snapshot                 = true
  deletion_protection                   = var.db_deletion_protection
  skip_final_snapshot                   = false
  final_snapshot_identifier             = "${local.name}-final"
  auto_minor_version_upgrade            = true
  iam_database_authentication_enabled   = true
  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.main.arn
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  ca_cert_identifier                    = "rds-ca-rsa2048-g1"
}

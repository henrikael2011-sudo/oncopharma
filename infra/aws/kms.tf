# Chave KMS gerenciada pelo cliente (rotação anual) para RDS, Secrets Manager, CloudWatch Logs, ECR e S3 de artefatos.
data "aws_iam_policy_document" "kms" {
  #checkov:skip=CKV_AWS_356:Política de chave KMS: "*" refere-se à própria chave (padrão AWS).
  #checkov:skip=CKV_AWS_111:Política padrão de chave KMS delega à conta (IAM controla o acesso).
  #checkov:skip=CKV_AWS_109:Idem; administração da chave restrita por IAM da conta.
  statement {
    sid       = "AccountAdmin"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"]
    }
  }
  statement {
    sid       = "CloudWatchLogs"
    actions   = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${var.region}:${local.account_id}:log-group:*"]
    }
  }
}

resource "aws_kms_key" "main" {
  description             = "${local.name} dados (RDS, segredos, logs, ECR, S3)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

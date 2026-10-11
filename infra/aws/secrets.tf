# Segredos: somente os "contêineres" são criados aqui. Os VALORES são gravados fora do Terraform
# (console/CLI por pessoa autorizada), para não ficarem no estado. Nenhuma credencial real neste repositório.
#   aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<valor>'
locals {
  secret_names = {
    app_db_url           = "Connection string da role oncopharma_app (sem superusuário/BYPASSRLS), sslmode=verify-full"
    care_oidc_client     = "OIDC_CLIENT_SECRET do app Care (Entra/Google exigem segredo em cliente web confidencial)"
    clinical_oidc_client = "OIDC_CLIENT_SECRET do app Clinical"
    admin_oidc_client    = "OIDC_CLIENT_SECRET do app Admin"
    care_session_key     = "SESSION_ENCRYPTION_KEY (32 bytes base64) do Care"
    clinical_session_key = "SESSION_ENCRYPTION_KEY (32 bytes base64) do Clinical"
    admin_session_key    = "SESSION_ENCRYPTION_KEY (32 bytes base64) do Admin"
  }
}

resource "aws_secretsmanager_secret" "app" {
  #checkov:skip=CKV2_AWS_57:Valores gravados fora do Terraform; rotação manual documentada (README) até existir Lambda de rotação para a role oncopharma_app.
  for_each                = local.secret_names
  name                    = "${var.project}/${var.environment}/${each.key}"
  description             = each.value
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 30
}

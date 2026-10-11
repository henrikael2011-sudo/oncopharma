# HML — homologação técnica; dados sintéticos até aprovação G01–G09.
environment              = "hml"
allowed_account_ids      = ["000000000000"] # PREENCHER: conta AWS de hml
data_classification      = "synthetic"
domain_name              = "hml.oncopharma.example.com.br" # PREENCHER
az_count                 = 2
single_nat_gateway       = false
db_instance_class        = "db.t4g.medium"
db_multi_az              = true
db_backup_retention_days = 14
db_deletion_protection   = true
log_retention_days       = 365
admin_allowed_cidrs      = [] # PREENCHER
idp_provider             = "entra"
# oidc_settings: ver docs/integracao/IDP_ENTRA_ID.md (valores não secretos por app). Exemplo de forma:
# oidc_settings = {
#   api          = { OIDC_ISSUER = "https://login.microsoftonline.com/<TENANT_ID>/v2.0", OIDC_AUDIENCE = "<API_APP_CLIENT_ID>", OIDC_JWKS_URI = "https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys", OIDC_SUBJECT_CLAIM = "oid", OIDC_MFA_AMR = "mfa", OIDC_MFA_ACRS = "c1" }
#   clinical-web = { OIDC_ISSUER = "...", OIDC_CLIENT_ID = "<CLINICAL_CLIENT_ID>", ... }
# }

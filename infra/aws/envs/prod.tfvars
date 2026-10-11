# PROD — NÃO aplicar antes da aprovação formal G01–G09 (uso clínico não aprovado).
environment              = "prod"
allowed_account_ids      = ["000000000000"] # PREENCHER: conta AWS de produção (separada de dev/hml)
data_classification      = "health-personal-data"
domain_name              = "oncopharma.example.com.br" # PREENCHER
az_count                 = 3
single_nat_gateway       = false
db_instance_class        = "db.m7g.large"
db_multi_az              = true
db_backup_retention_days = 35
db_deletion_protection   = true
log_retention_days       = 1827 # 5 anos (confirmar política de retenção com jurídico/LGPD)
admin_allowed_cidrs      = []   # PREENCHER
idp_provider             = "entra"

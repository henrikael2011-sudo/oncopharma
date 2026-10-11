# DEV — somente dados sintéticos. Valores fictícios: substituir pelos reais fora do repositório se necessário.
environment              = "dev"
allowed_account_ids      = ["000000000000"] # PREENCHER: conta AWS de dev
data_classification      = "synthetic"
domain_name              = "dev.oncopharma.example.com.br" # PREENCHER
az_count                 = 2
single_nat_gateway       = true
db_instance_class        = "db.t4g.medium"
db_multi_az              = true # decisão: Multi-AZ; em dev pode ser false para reduzir custo (registrar exceção)
db_backup_retention_days = 7
db_deletion_protection   = false
log_retention_days       = 90
admin_allowed_cidrs      = [] # PREENCHER: CIDR da rede institucional/VPN
idp_provider             = "entra"

variable "region" {
  description = "Região AWS. D-010: somente sa-east-1 (São Paulo)."
  type        = string
  default     = "sa-east-1"
  validation {
    condition     = var.region == "sa-east-1"
    error_message = "D-010: dados e processamento devem permanecer em sa-east-1."
  }
}

variable "environment" {
  description = "Ambiente (deve coincidir com o workspace Terraform)."
  type        = string
  validation {
    condition     = contains(["dev", "hml", "prod"], var.environment)
    error_message = "environment deve ser dev, hml ou prod."
  }
}

variable "allowed_account_ids" {
  description = "Conta(s) AWS permitidas para este ambiente (proteção contra apply na conta errada)."
  type        = list(string)
}

variable "project" {
  type    = string
  default = "oncopharma"
}

variable "owner" {
  description = "Responsável (tag Owner)."
  type        = string
  default     = "henrikael"
}

variable "cost_center" {
  type    = string
  default = "oncopharma"
}

variable "data_classification" {
  description = "Classificação dos dados (tag). dev/hml: synthetic. prod: health-personal-data (LGPD art. 11)."
  type        = string
  validation {
    condition     = contains(["synthetic", "health-personal-data"], var.data_classification)
    error_message = "Use synthetic ou health-personal-data."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "availability_zones" {
  description = "AZs fixadas explicitamente (evita expansão silenciosa)."
  type        = list(string)
  default     = ["sa-east-1a", "sa-east-1b", "sa-east-1c"]
}

variable "az_count" {
  description = "Zonas de disponibilidade (sa-east-1 tem a, b, c)."
  type        = number
  default     = 2
  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "Use 2 ou 3 AZs (Multi-AZ exige ao menos 2)."
  }
}

variable "single_nat_gateway" {
  description = "true = 1 NAT (economia; dev). false = 1 NAT por AZ (hml/prod)."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Domínio base (ex.: oncopharma.example.com.br). Subdomínios: care, clinical, admin, api."
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone pública do domínio (validação ACM e registros). Vazio = validar/apontar DNS manualmente."
  type        = string
  default     = ""
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 50
}

variable "db_max_allocated_storage_gb" {
  type    = number
  default = 200
}

variable "db_multi_az" {
  description = "RDS Multi-AZ (decisão: obrigatório em hml/prod)."
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "Retenção de backups automáticos (habilita PITR). 1–35."
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "1 a 35 dias (0 desabilitaria PITR)."
  }
}

variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "log_retention_days" {
  type    = number
  default = 365
}

variable "image_tag" {
  description = "Tag imutável das imagens no ECR (ex.: SHA do commit)."
  type        = string
  default     = "bootstrap"
}

variable "services" {
  description = "Serviços ECS Fargate. desired_count=0 até existirem imagens publicadas."
  type = map(object({
    port          = number
    cpu           = number
    memory        = number
    desired_count = number
    health_path   = string
    subdomain     = string
    public        = bool
  }))
  default = {
    api          = { port = 4000, cpu = 512, memory = 1024, desired_count = 0, health_path = "/v1/health", subdomain = "api", public = false }
    care-web     = { port = 3001, cpu = 512, memory = 1024, desired_count = 0, health_path = "/api/health", subdomain = "care", public = true }
    clinical-web = { port = 3002, cpu = 512, memory = 1024, desired_count = 0, health_path = "/api/health", subdomain = "clinical", public = true }
    admin-web    = { port = 3003, cpu = 256, memory = 512, desired_count = 0, health_path = "/api/health", subdomain = "admin", public = true }
  }
}

variable "admin_allowed_cidrs" {
  description = "CIDRs (rede institucional/VPN) autorizados a acessar admin.<domínio>. Vazio = admin bloqueado no WAF."
  type        = list(string)
  default     = []
}

variable "waf_rate_limit_per_5min" {
  type    = number
  default = 1000
}

variable "idp_provider" {
  description = "D-009: entra (instituição com Office 365) ou google (Google Workspace via broker OIDC). Afeta só documentação/variáveis."
  type        = string
  default     = "entra"
  validation {
    condition     = contains(["entra", "google"], var.idp_provider)
    error_message = "entra ou google."
  }
}

variable "oidc_settings" {
  description = "Configuração OIDC NÃO secreta por app (issuer, endpoints, client_id, escopos). Segredos ficam no Secrets Manager."
  type        = map(map(string))
  default     = {}
}

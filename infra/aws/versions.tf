# ONCOPHARMA — rascunho de infraestrutura AWS (sa-east-1). NÃO APLICADO. Sem credenciais reais.
# Decisões: D-010 (AWS sa-east-1, dados no Brasil/LGPD). Ver docs/product/DECISOES_M15.md.
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  # Estado remoto: S3 (sa-east-1) com bloqueio nativo e criptografia. Configuração parcial,
  # informada no init: terraform init -backend-config=envs/backend-<env>.hcl
  backend "s3" {}
}

provider "aws" {
  region              = var.region
  allowed_account_ids = var.allowed_account_ids
  default_tags {
    tags = local.tags
  }
}

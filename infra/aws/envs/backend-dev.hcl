# Backend remoto (criar antes: bucket S3 versionado+criptografado em sa-east-1). Sem credenciais aqui.
bucket       = "PREENCHER-oncopharma-tfstate-dev"
key          = "oncopharma/terraform.tfstate"
region       = "sa-east-1"
encrypt      = true
use_lockfile = true

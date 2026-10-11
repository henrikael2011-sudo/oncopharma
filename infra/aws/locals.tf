data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.environment}"
  azs  = slice(var.availability_zones, 0, var.az_count)
  tags = {
    Project            = var.project
    Environment        = var.environment
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = var.data_classification
    DataResidency      = "BR"
    ManagedBy          = "terraform"
    ClinicalUse        = "not-approved"
    IdentityProvider   = var.idp_provider
  }
  public_services = { for k, v in var.services : k => v if v.public }
  fqdn            = { for k, v in var.services : k => "${v.subdomain}.${var.domain_name}" }
  account_id      = data.aws_caller_identity.current.account_id
}

# Proteção: workspace Terraform deve coincidir com o ambiente (dev/hml/prod).
resource "terraform_data" "workspace_guard" {
  lifecycle {
    precondition {
      condition     = terraform.workspace == var.environment
      error_message = "Selecione o workspace igual a var.environment (terraform workspace select <env>)."
    }
  }
}

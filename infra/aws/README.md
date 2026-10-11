# ONCOPHARMA — Terraform AWS sa-east-1 (rascunho, D-010)

**Não aplicado.** Sem credenciais reais. Produção só após G01–G09. Validado localmente: `terraform fmt -check` e `terraform validate` (init com `-backend=false`), tflint (0 achados) e checkov (375 passed / 0 failed / 23 skipped com justificativa no código). Evidências: `artifacts/validation/m15/`.

## O que cria
- VPC 10.40.0.0/16 em 2–3 AZs fixas: sub-redes públicas (só ALB/NAT), privadas de aplicação e privadas de banco (sem rota à internet); NAT (1 em dev, 1 por AZ em hml/prod); VPC endpoints (S3, ECR, Secrets Manager, Logs, KMS); flow logs criptografados.
- KMS (CMK com rotação) para RDS, Secrets Manager, CloudWatch Logs, ECR e S3 de artefatos.
- RDS PostgreSQL 17 **Multi-AZ**, criptografado com KMS, `publicly_accessible=false`, backups automáticos (PITR) 7/14/35 dias, `rds.force_ssl=1`, Performance Insights, Enhanced Monitoring, deletion protection, snapshot final. Senha mestre gerenciada pelo RDS no Secrets Manager.
- ECS Fargate (ARM64): `api`, `care-web`, `clinical-web`, `admin-web` em sub-redes privadas, sem IP público, circuit breaker com rollback; ECR imutável com scan e KMS; logs no CloudWatch (KMS, retenção por ambiente). `desired_count=0` até haver imagens.
- ALB público (care/clinical/admin, HTTPS TLS 1.2/1.3 com ACM, HTTP→HTTPS) e ALB **interno** para a API (`api.internal.<dominio>`, zona Route 53 privada). A API não é exposta à internet.
- WAF: regras gerenciadas AWS (Common, KnownBadInputs/Log4j, SQLi, IP reputation, Anonymous IP), limite por IP, **admin.<dominio> só a partir de CIDRs institucionais** (vazio = bloqueado); logs com `authorization`/`cookie` mascarados.
- Secrets Manager: contêineres para URL do banco da role `oncopharma_app`, segredos OIDC e chaves de sessão por app — **valores gravados fora do Terraform**.
- S3 de artefatos (SSE-KMS, versionado, TLS obrigatório, sem acesso público, log de acesso) e S3 de logs do ALB (SSE-S3, exigência do serviço).
- Tags: Project, Environment, Owner, CostCenter, DataClassification, DataResidency=BR, ClinicalUse=not-approved, IdentityProvider.

## Ordem de provisionamento
1. Contas AWS separadas por ambiente (AWS Organizations), MFA na raiz, CloudTrail organizacional, IAM Identity Center. Preencher `allowed_account_ids` nos `envs/*.tfvars`.
2. Criar o bucket de estado (S3 versionado + criptografado, sa-east-1) por conta; ajustar `envs/backend-<env>.hcl`.
3. `terraform init -backend-config=envs/backend-<env>.hcl` → `terraform workspace new <env>` (ou `select`).
4. Domínio: hosted zone pública no Route 53 (`route53_zone_id`) ou criar manualmente os CNAMEs de `acm_validation_records`.
5. `terraform plan -var-file=envs/<env>.tfvars -out plan` → revisão em PR → `terraform apply plan`.
6. Gravar os valores dos segredos (`aws secretsmanager put-secret-value`), incluindo `app_db_url` com `sslmode=verify-full`.
7. Bootstrap do banco a partir de tarefa administrativa dentro da VPC: migrações 0001–0008 + `provision-app-role.sh` (role sem SUPERUSER/BYPASSRLS). Nunca pela API.
8. Publicar imagens no ECR com tag imutável (SHA do commit) — Dockerfiles ainda não existem (pendente) — e ajustar `image_tag`/`desired_count`.
9. Configurar `oidc_settings` conforme `docs/integracao/IDP_*.md` após o cadastro institucional.
10. hml: rodar a suíte E2E/`validate:evidence` contra o ambiente. prod: somente após G01–G09.

## Achados do checkov aceitos (justificativa no código, `#checkov:skip`)
| Check | Motivo |
|---|---|
| CKV_AWS_378 (alvos HTTP) | TLS termina no ALB; alvos em sub-redes privadas. Evolução: TLS ponta a ponta. |
| CKV_AWS_2/103/260 (porta 80) | Listener só redireciona 301 para HTTPS. |
| CKV2_AWS_57 (rotação de segredos) | Valores fora do Terraform; rotação manual (90 dias) até haver Lambda de rotação. |
| CKV_AWS_144 (replicação entre regiões) | D-010: dados só no Brasil; sa-east-1 é a única região AWS no país. |
| CKV2_AWS_62 (notificações S3) | Sem consumidor definido. |
| CKV_AWS_145/18 (bucket de logs do ALB) | O serviço só aceita SSE-S3; é o próprio bucket de destino de logs. |
| CKV_AWS_109/111/356 (política da chave KMS) | Política padrão de chave (delegação à conta). |
Achados iniciais antes dos ajustes: 26 (ver `checkov-inicial.txt`); corrigidos de fato: AZs fixas, deletion protection dos ALBs, log de acesso do bucket de artefatos, regras Log4j/IP anônimo.

## Pendências conhecidas
- Dockerfiles e pipeline de publicação no ECR; tarefa de migração; alarmes (RDS, ALB 5xx, WAF) e SNS; AWS Backup com cópia em cofre (mesma região); GuardDuty/Security Hub/Config na organização.
- Os fluxos sintéticos atuais exigem `NODE_ENV≠production`; definir como o hml sintético roda (variável de ambiente explícita de modo sintético) antes do primeiro deploy.
- Broker Keycloak (caso Google Workspace, D-009) não está incluído: exigiria serviço ECS + banco próprio.

## Custos (ESTIMATIVAS, faixas aproximadas, sa-east-1, sem impostos; conferir na AWS Pricing Calculator)
| Ambiente | Itens principais | Estimativa mensal |
|---|---|---|
| dev | RDS db.t4g.medium Multi-AZ, 1 NAT, 4 tarefas Fargate pequenas, 2 ALB, WAF, endpoints | **~US$ 450–750** |
| hml | igual ao dev com NAT por AZ e retenção maior | **~US$ 550–900** |
| prod | RDS db.m7g.large Multi-AZ, 3 AZs/NAT, tarefas com 2+ réplicas, logs 5 anos | **~US$ 1.200–2.500** |
Maiores componentes: RDS Multi-AZ (dobra o custo da instância), NAT Gateways (hora + GB), VPC interface endpoints (por AZ), ALBs e WAF (por regra + requisições). Economia em dev: `desired_count=0` fora do horário, 1 NAT, Multi-AZ desligado como exceção registrada. **Valores são estimativas, não cotação.**

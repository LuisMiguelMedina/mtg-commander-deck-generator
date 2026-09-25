# Despliegue AWS + GitHub Actions (manafoundry.gg y Lambda)

Historic Brawl usa **snapshot estático** (`public/data/brawl-community-snapshot.json`) en GitHub Pages **sin AWS**. Para **manafoundry.gg** y la Lambda de analytics (acciones `brawl-popularity` / `brawl-top-commanders`), configura lo siguiente una vez.

## 1. Desplegar stacks CDK (máquina con AWS CLI)

```bash
cd infra
npm ci
export GITHUB_OWNER=LuisMiguelMedina
export GITHUB_REPO=mtg-commander-deck-generator

# Sitio S3 + CloudFront + rol OIDC para el front (si aún no existe)
npx cdk deploy MtgDeckBuilderSite --require-approval never

# Analytics (DynamoDB + Lambda URL + rol OIDC para CI)
npx cdk deploy MtgDeckBuilderAnalytics --require-approval never
```

Anota los outputs:

| Output CDK | Dónde usarlo |
|------------|----------------|
| `DeployRoleArn` (Site) | GitHub secret `AWS_DEPLOY_ROLE_ARN` |
| `SiteBucketName` | GitHub secret `SITE_BUCKET` |
| `DistributionId` | GitHub secret `CLOUDFRONT_ID` |
| `AnalyticsDeployRoleArn` | GitHub secret `AWS_ANALYTICS_DEPLOY_ROLE_ARN` (recomendado) |
| `AnalyticsFunctionUrl` | GitHub variable `VITE_ANALYTICS_URL` (opcional; el front tiene fallback) |

## 2. Secrets en GitHub

Repo → **Settings → Secrets and variables → Actions**:

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn del Site stack>"
gh secret set SITE_BUCKET --body "<SiteBucketName>"
gh secret set CLOUDFRONT_ID --body "<DistributionId>"
gh secret set AWS_ANALYTICS_DEPLOY_ROLE_ARN --body "<AnalyticsDeployRoleArn>"
gh variable set VITE_ANALYTICS_URL --body "<AnalyticsFunctionUrl>"
```

Opcional: `VITE_METRICS_SECRET`, `POLL_ADMIN_SECRET` si usas métricas/polls protegidos.

## 3. Workflows

| Workflow | Qué hace |
|----------|----------|
| **Deploy to GitHub Pages** | Build + snapshot + Pages (no requiere AWS) |
| **Refresh Brawl community snapshot** | Lunes 06:00 UTC o manual; actualiza JSON Archidekt |
| **Deploy to AWS (manafoundry.gg)** | Sube `dist/` a S3 + invalida CloudFront (requiere secrets) |
| **Deploy Analytics Lambda** | `cdk deploy MtgDeckBuilderAnalytics` (requiere rol OIDC) |

Si faltan secrets, los jobs de AWS **se saltan con aviso** (no fallan en rojo).

## 4. Comprobar Brawl en producción

```bash
curl -s "https://luismiguelmedina.github.io/mtg-commander-deck-generator/data/brawl-community-snapshot.json" | head
curl -s "<AnalyticsFunctionUrl>?action=brawl-top-commanders" | head
```

Tras desplegar la Lambda nueva, la segunda URL debe devolver JSON con `names` (no `Unauthorized`).

## 5. Solo actualizar Lambda (script local)

```bash
./infra/deploy-analytics.sh
```

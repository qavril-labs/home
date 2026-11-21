# Deploy to staging (AWS ECS on Fargate)

Status: the images and the manual workflow `.github/workflows/deploy-staging.yml` are written but **have not been run**. Nothing deploys until the pieces below exist. The workflow checks for each one and stops with a plain error naming what is missing.

Known so far: AWS account `929219061572`, region `ap-south-1` (Mumbai), ECS clusters `qavril-staging` and `qavril-prod` with no services yet. Production is not wired to any workflow.

## What to create in AWS (staging)

| Piece | Name the workflow expects |
|---|---|
| ECR repositories | `qavril/api` and `qavril/uaap` |
| ECS task definitions (Fargate) | `qavril-staging-api`, `qavril-staging-worker`, `qavril-staging-uaap`. The container is the first one listed. The worker uses the API image with the command `node_modules/.bin/tsx apps/worker/src/main.ts`. |
| ECS services in `qavril-staging` | `qavril-staging-api` (behind an Application Load Balancer, port 3002), `qavril-staging-worker` (no load balancer), `qavril-staging-uaap` (port 8090, reachable by the API only) |
| Task role and execution role | The execution role pulls images and reads the secrets. The task role of the API and worker needs `ses:SendEmail` and `ses:SendRawEmail` on the verified sender. |
| Secrets (Secrets Manager or SSM) | `DATABASE_URL` (owner role, used for migrations), `APP_DATABASE_URL` (non-superuser app role), `REDIS_URL`, `PLATFORM_ADMIN_KEY` (32+ characters), plus the agent service's own settings. Reference them in the task definition by ARN, never as plain values. |
| Plain environment | `SES_FROM_ADDRESS`, `SES_REGION=ap-south-1`, `CORS_ORIGINS`, `TRUST_PROXY=true` |
| IAM role for GitHub | See below. |

The API reads `DATABASE_URL`. In staging that must be the **app role** string so row-level security applies; migrations need the owner string, so the migration task should override `DATABASE_URL` with the owner secret. Confirm this split before the first run.

## GitHub settings

Repository **variables** (Settings, Secrets and variables, Actions, Variables), not secrets, because none is sensitive:

| Variable | Value |
|---|---|
| `AWS_REGION` | `ap-south-1` |
| `AWS_DEPLOY_ROLE_ARN` | ARN of the role below |
| `STAGING_SUBNET_IDS` | Comma-separated private subnet IDs for the migration task |
| `STAGING_SECURITY_GROUP_IDS` | Security group IDs that can reach the database and Redis |

Create a GitHub **environment** named `staging`, and add yourself as a required reviewer if you want a click before each deploy.

## OIDC role

Add GitHub as an identity provider in IAM (`token.actions.githubusercontent.com`, audience `sts.amazonaws.com`), then create a role with this trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::929219061572:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:qavril-labs/home:environment:staging"
      }
    }
  }]
}
```

Permissions the role needs: ECR push and pull on the two repositories (`ecr:GetAuthorizationToken` on `*`, and the layer and image actions on the repositories); `ecs:DescribeServices`, `DescribeTaskDefinition`, `RegisterTaskDefinition`, `UpdateService`, `RunTask`, `DescribeTasks` and `ecs:Wait` reads on the staging cluster; and `iam:PassRole` for the task and execution roles only.

## Not covered

- **Web app and site:** hosting is undecided, so there is no deploy step for `frontend/`. Set `apiBase` to the staging API address when that is added.
- **Production:** no workflow. Add one after staging has been seen working, with a required reviewer.
- **Rollback:** point the service at the previous task definition revision (`aws ecs update-service --task-definition <family>:<previous>`). The workflow does not do this automatically.

# Runbook — local ops, backup, and R2 cutover

## Daily start (after a machine restart)
1. Open **Docker Desktop** → wait for **Engine running**.
2. `cd C:\Users\HP\CrediScout-App` → `docker compose up -d postgres s3`.
3. `npm run dev -- -p 3005` (dev) — verify `GET /api/health` → `{"ok":true,"db":"up"}`.

## Environment variables (see `.env.example`)
| Var | Local | Cloud |
|---|---|---|
| `DATABASE_URL` | `postgresql://crediscout:crediscout-dev@localhost:5432/crediscout` | managed PG16 URL |
| `BETTER_AUTH_SECRET` | long random string (replace the placeholder!) | secret manager |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | public URL |
| `STORAGE` | `local` | `r2` |
| `S3_ENDPOINT_LOCAL` etc. | `http://localhost:9090`, `test`/`test` | unused |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | placeholders (ignored unless `STORAGE=r2`) | real values |

## Backup (Postgres)
```powershell
docker exec crediscout-app-postgres-1 pg_dump -U crediscout crediscout > "backup-$(Get-Date -Format yyyyMMdd).sql"
```
Keep copies off-machine. S3Mock data lives in the `s3mockdata` volume (documents);
back it up with `docker run --rm -v crediscout-app_s3mockdata:/data -v ${PWD}:/out alpine tar czf /out/s3mockdata.tgz /data`.

## Restore
```powershell
Get-Content backup-YYYYMMDD.sql | docker exec -i crediscout-app-postgres-1 psql -U crediscout crediscout
```

## R2 cutover (cloud)
1. Create the `crediscout-docs` bucket in Cloudflare R2; mint an API token.
2. Set `STORAGE=r2` + `R2_*` vars; redeploy.
3. Re-verify: upload a document, download it, confirm the summary PDF still builds.
   (Same S3-compatible calls; see ADR 0003. Re-check presigned flows if ever added.)

## Seed & migrations
- `npx prisma migrate dev` (creates + applies), `npm run db:seed` (idempotent:
  thresholds, §17 rates, demo users — safe to re-run).
- Never hand-edit the database; rate changes go through `/admin/rates`.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Can't reach database server` | Docker Desktop not running, or `docker compose up -d postgres s3` |
| `prisma generate` EPERM on `.dll.node` | dev server holds the file — stop it, regenerate, restart |
| Sign-in 401 “User not found” on fresh seeds | credential `Account.accountId` must equal `user.id` (ADR 0002) |
| `docker compose up` image pull errors | MinIO/LocalStack registries are restricted — repo now uses `adobe/s3mock` |
| CI fails on `prisma validate` | dummy `DATABASE_URL` must be set (job-level env in `ci.yml`) |

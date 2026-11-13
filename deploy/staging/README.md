# Staging on AWS Lightsail

The hosted staging environment (RAA-156): one Lightsail instance running `compose.yml` — Caddy (HTTPS), Postgres with PostGIS, Valkey (RAA-199; unused since AnyCable, kept for scaling it out), AnyCable's WebSocket server (RAA-202), the Rails API and the Next.js web app. Postgres moved here from Neon in RAA-174, after Neon's free tier ran out. Every merge into `staging` that touches `backend/`, `web/` or this folder runs `.github/workflows/deploy-staging.yml`: it builds both images, pushes them to GHCR and restarts the instance on them.

- Web: https://staging.tripkonext.com
- API: https://api.staging.tripkonext.com (`/up`, `/api/v1/health`)

## One-time setup

### 1. Instance

In the Lightsail console, under the team's AWS account:

1. Create an instance: Linux, **Ubuntu 24.04 LTS**, region **Singapore** (`ap-southeast-1`), the **1 GB** plan (move up to 2 GB from a snapshot if memory runs short).
2. Networking → **Create static IP** and attach it to the instance.
3. Networking → IPv4 firewall: keep SSH (22), add HTTP (80) and HTTPS (443). Nothing else.

### 2. DNS (GoDaddy, `tripkonext.com`)

Add two **A** records, both with the static IP as their value: `staging` and `api.staging`. Don't use CNAMEs. Check before going on: `dig +short staging.tripkonext.com` and `dig +short api.staging.tripkonext.com` both print the IP. Caddy can't get certificates until they do.

### 3. Server

Connect with the browser SSH in the Lightsail console (user `ubuntu`), then:

```bash
# Docker, from Docker's own apt repository
curl -fsSL https://get.docker.com | sudo sh

# 2 GB of swap: the instance has 1 GB of memory and Rails, Next and Caddy share it
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# The user GitHub Actions deploys as. Only it, and only with its own key.
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy -m 750 /opt/tripkonext
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
```

Membership in the `docker` group is effectively root on this machine. The deploy key's only job is the deploy, so keep it nowhere but the GitHub secret.

### 4. Deploy key

On your own machine:

```bash
ssh-keygen -t ed25519 -N "" -C "github-deploy-staging" -f deploy_staging
ssh-keyscan -t ed25519 <static IP>      # the host key, for LIGHTSAIL_KNOWN_HOSTS
```

Put `deploy_staging.pub` into `/home/deploy/.ssh/authorized_keys` on the instance (owner `deploy`, mode 600). Then delete both key files from your machine once step 6 is done.

### 5. Secrets on the instance

As `deploy` (`sudo -iu deploy`):

1. Fill in `/opt/tripkonext/db.env` from `db.env.example` in this folder, with three new passwords (`openssl rand -hex 24` each).
2. Fill in `/opt/tripkonext/backend.env` from `backend.env.example`: the app role's password in the three runtime database URLs, the owner's in the three `MIGRATION_*` ones. Leave the `MIGRATION_*` lines out until the first deploy has run `./db-roles.sh` (see "Database roles" below).
3. Create `/opt/tripkonext/anycable.env` (`anycable.env.example`) with a new secret, without printing it: `printf 'ANYCABLE_SECRET=%s\n' "$(openssl rand -hex 32)" > anycable.env`. Then run `chmod 600 db.env backend.env anycable.env`.
4. Let the instance pull the private images: create a GitHub personal access token (classic) with only `read:packages`, then:

   ```bash
   echo "<token>" | docker login ghcr.io -u <github user> --password-stdin
   ```

### 6. GitHub

Under repository Settings → Secrets and variables → Actions:

- **Secrets**:
  - `LIGHTSAIL_HOST`: the static IP
  - `LIGHTSAIL_SSH_KEY`: the private key `deploy_staging`
  - `LIGHTSAIL_KNOWN_HOSTS`: the `ssh-keyscan` line
- **Variables**:
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_FACEBOOK_APP_ID`: same as Vercel's

`NEXT_PUBLIC_SITE_URL` (the web URL) and `NEXT_PUBLIC_SITE_INDEXABLE=false` are set in the workflow itself, not as variables: staging stays out of search results (RAA-247) — robots.txt disallows everything, every page says noindex, and the `Caddyfile` sends `X-Robots-Tag: noindex, nofollow` on both hosts. A production deploy sets its own URL and `NEXT_PUBLIC_SITE_INDEXABLE=true`, and leaves the Caddy header out.

Then deploy for the first time: `gh workflow run deploy-staging.yml --ref staging`.

### 7. Services that know the URL

Each of these must name the new web or API URL:

- **Google OAuth client**: add `https://staging.tripkonext.com` as an authorised JavaScript origin.
- **Facebook app**: add the same URL to its domains and origins.
- **Didit**: change the webhook to `https://api.staging.tripkonext.com/api/v1/webhooks/didit`.
- **Cloudflare R2 bucket**: add `https://staging.tripkonext.com` to its CORS allowed origins, because the browser uploads photos straight to R2.

## Day to day

```bash
ssh deploy@<static IP>
cd /opt/tripkonext
docker compose ps
docker compose logs -f backend     # or web, caddy, anycable
docker compose exec backend bin/rails console
```

**Rolling back**: set an earlier commit's images in `.env` (`IMAGE_TAG=<full commit SHA>`, from a previous deploy run), then run `docker compose up -d`. The next deploy goes back to the newest commit. A migration is not rolled back this way.

**Postgres**: `docker compose exec db psql -U postgres rent_anything_staging` (the superuser; the API itself connects as `rent_anything_app`, see "Database roles"). The data lives in the `postgres_data` volume. `docker compose down -v` deletes it, so never run that here.

**Changing a secret**: edit `backend.env`, then run `docker compose up -d backend` (for `anycable.env`, `docker compose up -d backend anycable`). A `NEXT_PUBLIC_*` value is a GitHub variable baked into the web image, so it only takes effect after the workflow runs again.

## Database roles (RAA-217)

The API doesn't connect as the `postgres` superuser. `db-roles.sh` (copied here by every deploy) sets up two roles, neither a superuser nor able to bypass row level security:

- `rent_anything_owner` owns the three databases and everything in them. `db:prepare` runs as it on every boot, through the `MIGRATION_*` URLs in `backend.env`.
- `rent_anything_app` is what the API runs as: it reads and writes rows (and refreshes the `search_terms` view, through `MAINTAIN`) but can't create, alter or drop anything. PostGIS's `spatial_ref_sys` is read only for it. Tables the owner creates later get the same grants by default.

The script is idempotent: run it again after a restore, after changing either password, or whenever in doubt. It reads the passwords from `db.env` and never prints them. As `deploy` in `/opt/tripkonext`, with `db` up: `./db-roles.sh`, then `docker compose up -d backend`.

**Switching an existing instance over** (once, before the PR that brings this merges):

1. `scp deploy/staging/db-roles.sh deploy@<static IP>:/opt/tripkonext/` from a checkout of the PR branch (later deploys copy it themselves).
2. Add `RENT_ANYTHING_OWNER_PASSWORD` and `RENT_ANYTHING_APP_PASSWORD` to `db.env` (`openssl rand -hex 24` each, written without printing them).
3. Run the nightly backup line below by hand, so there is a dump from just before.
4. `./db-roles.sh`. Every database should print `ok`. The running API is unaffected, because it still connects as `postgres`.
5. In `backend.env`, add the three `MIGRATION_*` URLs and change the three runtime URLs to `rent_anything_app` (`backend.env.example`). Keep the old lines commented out for the rollback.
6. Merge. The deploy restarts the API with the new image and URLs. Then check:
   - `curl -fsS https://api.staging.tripkonext.com/api/v1/health`
   - `docker compose exec backend bin/rails runner 'p ActiveRecord::Base.connection.select_rows("SELECT current_user, usesuper FROM pg_user WHERE usename = current_user")'` prints `[["rent_anything_app", false]]`
   - a booking can still be made and paid end to end.

**Rolling back**: put the `postgres` URLs back in `backend.env`, remove the three `MIGRATION_*` lines and run `docker compose up -d backend`. The roles and ownership can stay, since `postgres` is a superuser. Nothing has to be undone in the database.

## Database backups

A nightly dump stays on the instance for 7 days. As `deploy`, run `crontab -e` and add this line:

```cron
30 3 * * * cd /opt/tripkonext && mkdir -p backups && docker compose exec -T db pg_dumpall -U postgres | gzip > backups/$(date +\%F).sql.gz && find backups -name '*.sql.gz' -mtime +7 -delete
```

Copies on the instance don't survive losing the instance. Also turn on **automatic snapshots** in the Lightsail console (instance → Snapshots), which keep the last 7 days.

To restore a dump into an empty `db`, run `gunzip -c backups/<date>.sql.gz | docker compose exec -T db psql -U postgres`, then `docker compose restart backend`.

## Moving off Neon (RAA-174, one time)

Neon's compute was suspended, so staging starts with empty databases. Do these steps on the instance before the PR merges:

1. Create `db.env` (section 5, "Secrets on the instance", above).
2. In `backend.env`, replace the three Neon URLs with the `db:5432` ones from `backend.env.example`.
3. Merge. The deploy starts `db`, and the backend's `db:prepare` creates the three databases and loads the schema.
4. Seed the areas again and recreate test accounts and listings.

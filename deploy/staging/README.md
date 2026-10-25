# Staging on AWS Lightsail

The hosted staging environment (RAA-156): one Lightsail instance running `compose.yml` — Caddy (HTTPS), Postgres with PostGIS, the Rails API and the Next.js web app. Redis is on Upstash. Postgres moved here from Neon in RAA-174, after Neon's free tier ran out. Every merge into `staging` that touches `backend/`, `web/` or this folder runs `.github/workflows/deploy-staging.yml`: it builds both images, pushes them to GHCR and restarts the instance on them.

- Web: https://staging.tripkonext.com
- API: https://api.staging.tripkonext.com (`/up`, `/api/v1/health`)

## One-time setup

### 1. Instance

In the Lightsail console, under the team's AWS account:

1. Create an instance: Linux, **Ubuntu 24.04 LTS**, region **Singapore** (`ap-southeast-1`, next to Upstash), the **1 GB** plan (move up to 2 GB from a snapshot if memory runs short).
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

1. Fill in `/opt/tripkonext/db.env` from `db.env.example` in this folder, with a new password (`openssl rand -hex 24`).
2. Fill in `/opt/tripkonext/backend.env` from `backend.env.example`, using the same password in the three database URLs. Then run `chmod 600 db.env backend.env`.
3. Let the instance pull the private images: create a GitHub personal access token (classic) with only `read:packages`, then:

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
  - `NEXT_PUBLIC_SECTION_SWITCH`: `true`

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
docker compose logs -f backend     # or web, caddy
docker compose exec backend bin/rails console
```

**Rolling back**: set an earlier commit's images in `.env` (`IMAGE_TAG=<full commit SHA>`, from a previous deploy run), then run `docker compose up -d`. The next deploy goes back to the newest commit. A migration is not rolled back this way.

**Postgres**: `docker compose exec db psql -U postgres rent_anything_staging`. The data lives in the `postgres_data` volume. `docker compose down -v` deletes it, so never run that here.

**Changing a secret**: edit `backend.env`, then run `docker compose up -d backend`. A `NEXT_PUBLIC_*` value is a GitHub variable baked into the web image, so it only takes effect after the workflow runs again.

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

# Staging on AWS Lightsail

The hosted staging environment (RAA-156): one Lightsail instance running `compose.yml` — Caddy (HTTPS), the Rails API and the Next.js web app. Postgres is on Neon and Redis on Upstash. Every merge into `staging` that touches `backend/`, `web/` or this folder runs `.github/workflows/deploy-staging.yml`: it builds both images, pushes them to GHCR and restarts the instance on them.

- Web: https://staging.tripkonext.com
- API: https://api.staging.tripkonext.com (`/up`, `/api/v1/health`)

## One-time setup

### 1. Instance

In the Lightsail console, under the team's AWS account:

1. Create an instance: Linux, **Ubuntu 24.04 LTS**, region **Singapore** (`ap-southeast-1`, next to Neon and Upstash), the **2 GB** plan.
2. Networking → **Create static IP** and attach it to the instance.
3. Networking → IPv4 firewall: keep SSH (22), add HTTP (80) and HTTPS (443). Nothing else.

### 2. DNS (GoDaddy, `tripkonext.com`)

Add two **A** records, both with the static IP as their value: `staging` and `api.staging`. Don't use CNAMEs. Check before going on: `dig +short staging.tripkonext.com` and `dig +short api.staging.tripkonext.com` both print the IP. Caddy can't get certificates until they do.

### 3. Server

Connect with the browser SSH in the Lightsail console (user `ubuntu`), then:

```bash
# Docker, from Docker's own apt repository
curl -fsSL https://get.docker.com | sudo sh

# 2 GB of swap: the instance has 2 GB of memory and Rails, Next and Caddy share it
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

1. Fill in `/opt/tripkonext/backend.env` from `backend.env.example` in this folder. Copy the values from the Render dashboard (`rent-anything-api` → Environment). Then run `chmod 600` on the file.
2. Let the instance pull the private images: create a GitHub personal access token (classic) with only `read:packages`, then:

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

**Changing a secret**: edit `backend.env`, then run `docker compose up -d backend`. A `NEXT_PUBLIC_*` value is a GitHub variable baked into the web image, so it only takes effect after the workflow runs again.

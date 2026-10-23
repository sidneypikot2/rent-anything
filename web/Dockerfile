# Production image of the web app for the hosted staging environment (RAA-156, deploy/staging/).
# Local development doesn't use it: Compose runs `npm run dev` in a plain node image.
# The Node major moves with docker-compose.yml's node:24-alpine (.claude/rules/infra.md).

FROM node:24-alpine AS deps
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /web
COPY --from=deps /web/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are baked into the browser bundle at build time, so they are build
# args (GitHub repository variables in deploy-staging.yml); changing one means a rebuild.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_FACEBOOK_APP_ID
ARG NEXT_PUBLIC_SECTION_SWITCH
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# The standalone output carries only the files the server needs; public/ and .next/static
# are copied next to it so server.js serves them too.
FROM node:24-alpine AS run
WORKDIR /web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /web/.next/standalone ./
COPY --from=build --chown=node:node /web/.next/static ./.next/static
COPY --from=build --chown=node:node /web/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

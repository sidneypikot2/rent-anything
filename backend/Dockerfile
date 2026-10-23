FROM ruby:4.0.6-slim

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libyaml-dev \
    libgeos-dev \
    libproj-dev \
    libvips42t64 \
    git \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
# Unset locally (Compose installs every group); the staging deploy passes development:test
# (.github/workflows/deploy-staging.yml).
ARG BUNDLE_WITHOUT
RUN bundle install

COPY . .

RUN chmod +x bin/docker-entrypoint

EXPOSE 3000

ENTRYPOINT ["bin/docker-entrypoint"]
CMD ["rails", "server", "-b", "0.0.0.0"]

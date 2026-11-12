#!/usr/bin/env bash
# The staging database's two roles (RAA-217): the API runs as rent_anything_app, which can read
# and write rows but owns nothing and can't change the schema; db:prepare and migrations run as
# rent_anything_owner, which owns the databases and everything in them. Neither is a superuser,
# and neither bypasses row level security.
#
# Idempotent: run it again after a restore, or whenever in doubt. It
#   - creates both roles, or resets their attributes and passwords,
#   - creates each database that is missing, owned by rent_anything_owner,
#   - makes rent_anything_owner the owner of each database, its public schema and the tables,
#     views, sequences, functions and types in it (extensions' own objects stay with postgres),
#   - grants rent_anything_app SELECT, INSERT, UPDATE, DELETE and MAINTAIN on the tables (MAINTAIN
#     lets the search_terms refresh job run REFRESH MATERIALIZED VIEW, which otherwise needs the
#     owner) and USAGE, SELECT on the sequences; extensions' tables (PostGIS's spatial_ref_sys)
#     are read only,
#   - sets default privileges so the tables and sequences rent_anything_owner creates later get
#     the same grants.
#
# Run it as deploy in /opt/tripkonext, with the stack's db service up:
#   ./db-roles.sh
# The passwords come from RENT_ANYTHING_OWNER_PASSWORD and RENT_ANYTHING_APP_PASSWORD, read from
# ./db.env unless already set. They reach psql through the environment (\getenv), never a command
# line, and nothing here prints them. DB_NAMES and PRIMARY_DB override the databases (a local test).
set -euo pipefail

if [ -z "${RENT_ANYTHING_OWNER_PASSWORD:-}" ] && [ -f db.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./db.env
  set +a
fi

for var in RENT_ANYTHING_OWNER_PASSWORD RENT_ANYTHING_APP_PASSWORD; do
  value="${!var:-}"
  if [ -z "$value" ]; then
    echo "db-roles: $var is not set (db.env)" >&2
    exit 1
  fi
  # Letters and digits only, as POSTGRES_PASSWORD: no escaping in the database URLs.
  if ! [[ "$value" =~ ^[A-Za-z0-9]+$ ]]; then
    echo "db-roles: $var must be letters and digits only (openssl rand -hex 24)" >&2
    exit 1
  fi
done
export RENT_ANYTHING_OWNER_PASSWORD RENT_ANYTHING_APP_PASSWORD

DB_NAMES="${DB_NAMES:-rent_anything_staging rent_anything_staging_cache rent_anything_staging_queue}"
PRIMARY_DB="${PRIMARY_DB:-rent_anything_staging}"

psql_db() {
  docker compose exec -T -e RENT_ANYTHING_OWNER_PASSWORD -e RENT_ANYTHING_APP_PASSWORD db \
    psql -U postgres -X -q -v ON_ERROR_STOP=1 "$@"
}

# Roles are cluster-wide. Terse errors: a failed statement isn't echoed with its password.
psql_db -d postgres <<'SQL'
\set VERBOSITY terse
\getenv owner_password RENT_ANYTHING_OWNER_PASSWORD
\getenv app_password RENT_ANYTHING_APP_PASSWORD
SELECT 'CREATE ROLE rent_anything_owner'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rent_anything_owner') \gexec
SELECT 'CREATE ROLE rent_anything_app'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rent_anything_app') \gexec
ALTER ROLE rent_anything_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'owner_password';
ALTER ROLE rent_anything_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'app_password';
SQL

for db in $DB_NAMES; do
  primary=false
  [ "$db" = "$PRIMARY_DB" ] && primary=true

  psql_db -d postgres -v db="$db" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER rent_anything_owner', :'db')
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
SELECT format('ALTER DATABASE %I OWNER TO rent_anything_owner', :'db') \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO rent_anything_app', :'db') \gexec
SQL

  psql_db -d "$db" -v primary="$primary" <<'SQL'
SET client_min_messages = warning;
-- PostGIS isn't a trusted extension, so the owner can't create it; the others (btree_gist,
-- pg_trgm, unaccent) are, but are created here too so a new database matches schema.rb.
\if :primary
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
\endif

ALTER SCHEMA public OWNER TO rent_anything_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Everything in public that postgres (or anyone else) owns moves to rent_anything_owner, except
-- what an extension owns, and sequences that belong to a column (they follow their table).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS name,
           CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW'
                          WHEN 'S' THEN 'SEQUENCE' WHEN 'f' THEN 'FOREIGN TABLE'
                          ELSE 'TABLE' END AS kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      AND c.relowner <> 'rent_anything_owner'::regrole
      AND NOT EXISTS (SELECT FROM pg_depend d
                      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                        AND (d.deptype = 'e' OR (c.relkind = 'S' AND d.deptype IN ('a', 'i'))))
  LOOP
    EXECUTE format('ALTER %s %s OWNER TO rent_anything_owner', r.kind, r.name);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proowner <> 'rent_anything_owner'::regrole
      AND NOT EXISTS (SELECT FROM pg_depend d
                      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO rent_anything_owner', r.name);
  END LOOP;

  -- Enums and domains (array types follow their element type).
  FOR r IN
    SELECT t.oid::regtype AS name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e', 'd')
      AND t.typowner <> 'rent_anything_owner'::regrole
      AND NOT EXISTS (SELECT FROM pg_depend d
                      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER TYPE %s OWNER TO rent_anything_owner', r.name);
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA public TO rent_anything_app;
GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON ALL TABLES IN SCHEMA public TO rent_anything_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rent_anything_app;

-- Extensions' tables (PostGIS's spatial_ref_sys) are read only.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, MAINTAIN ON %s FROM rent_anything_app', r.name);
    EXECUTE format('GRANT SELECT ON %s TO rent_anything_app', r.name);
  END LOOP;
END
$$;

-- What rent_anything_owner creates from now on (migrations, a recreated view).
ALTER DEFAULT PRIVILEGES FOR ROLE rent_anything_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON TABLES TO rent_anything_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rent_anything_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rent_anything_app;
SQL

  echo "db-roles: $db ok"
done

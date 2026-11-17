#!/usr/bin/env bash
# Runs the database tests against a throwaway local Postgres database.
# Usage: PGHOST=... PGUSER=... ./run_tests.sh   (needs createdb, dropdb and psql)
set -euo pipefail
cd "$(dirname "$0")"
DB="eatsooner_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f stub_supabase.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f ../schema.sql
psql -q -t -v ON_ERROR_STOP=1 -d "$DB" -f test_schema.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'

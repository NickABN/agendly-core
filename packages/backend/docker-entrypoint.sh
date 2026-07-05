#!/bin/sh
set -e

# Apply pending migrations (incl. the btree_gist exclusion constraint) before boot.
# Single-instance safe. For multi-instance deploys move this to a separate release job.
echo "Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "Starting Agendly backend..."
exec node dist/main

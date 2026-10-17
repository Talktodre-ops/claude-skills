#!/bin/sh
# Every 10 s: container CPU/memory, PgBouncer pools, database connections, free memory.
#   ./monitor.sh <run-name> &      (kill it when the run ends)
cd "$(dirname "$0")"
mkdir -p out
log=out/monitor-$1.log
while true; do
  {
    echo "== $(date +%T)"
    docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' | grep mimic
    for p in pool1 pool2; do
      docker compose exec -T $p sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -p 6432 -U $POSTGRES_USER pgbouncer -Atc "show pools"' 2>/dev/null | grep -v '^pgbouncer|' | awk -F'|' -v p=$p '{print p, "cl_active="$3, "cl_waiting="$4, "sv_active="$7, "sv_idle="$10, "maxwait="$14}'
    done
    docker compose exec -T db psql -U "${PGUSER:-app}" -d "${PGDATABASE:-app}" -Atc "select 'db_conns', count(*) from pg_stat_activity where datname=current_database()" 2>/dev/null
    free -m | awk 'NR==2{print "host_avail_mb", $7} NR==3{print "swap_used_mb", $3}'
  } >> "$log" 2>&1
  sleep 10
done

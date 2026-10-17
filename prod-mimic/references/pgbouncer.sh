# PgBouncer sidecar: transaction pooling on the API container's localhost.
# Reads the same POSTGRES_* values as the app, so credentials live in one place.
set -eu
umask 077
printf '"%s" "%s"\n' "$POSTGRES_USER" "$POSTGRES_PASSWORD" > /tmp/userlist.txt
cat > /tmp/pgbouncer.ini <<INI
[databases]
* = host=${POSTGRES_HOST:-db} port=5432 user=$POSTGRES_USER

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /tmp/userlist.txt
pool_mode = transaction
default_pool_size = ${POOL_SIZE:-20}
max_client_conn = 400
server_tls_sslmode = disable
ignore_startup_parameters = extra_float_digits
admin_users = $POSTGRES_USER
INI
exec pgbouncer /tmp/pgbouncer.ini

#!/usr/bin/env bash
# =============================================================================
# ProMove — EC2 Single-Server Auto-Deployment Script
# =============================================================================
# Tested on : Amazon Linux 2023, Ubuntu 22.04 LTS, Ubuntu 24.04 LTS
# Installs  : Node.js 20, Redis 7 (local 127.0.0.1), Nginx, PM2
# Processes : API (:5000) | Realtime (:5001) | Worker | Scheduler — via PM2
# Nginx     : :80 → static SPA + /api/* → :5000 + /socket.io/* → :5001
#
# Usage:
#   chmod +x deploy-ec2.sh
#   sudo bash deploy-ec2.sh
#
# Pre-set env vars to skip interactive prompts:
#   PUBLIC_HOST      — EC2 public IP or domain   (e.g. 13.234.56.78)
#   MONGODB_URI      — MongoDB connection string  (e.g. mongodb+srv://...)
#   FROM_EMAIL       — Sender email address       (default: noreply@localhost.local)
#   MAIL_TRANSPORT   — ses | smtp | json          (default: json)
#
# Optional (S3 file uploads):
#   AWS_REGION AWS_S3_BUCKET_NAME AWS_S3_PUBLIC_BASE_URL
#   AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ─── Script lives in the project root ────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$APP_DIR/Server"
CLIENT_DIR="$APP_DIR/Client"

# ─── Fixed config ─────────────────────────────────────────────────────────────
NODE_MAJOR=20
PORT_API=5000
PORT_REALTIME=5001
PORT_WORKER_METRICS=9091
PORT_SCHEDULER_HEALTH=9092
REDIS_PORT=6379
NGINX_PORT=80

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✔]${NC} $*"; }
info() { echo -e "${BLUE}[ℹ]${NC} $*"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $*"; }
err()  { echo -e "${RED}[✘]${NC} $*" >&2; }
step() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

die() { err "$1"; exit 1; }

# ─── Must run as root ─────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run as root: sudo bash deploy-ec2.sh"

# Determine the non-root user who owns the project (for PM2 / file ownership)
APP_USER="${SUDO_USER:-}"
if [[ -z "$APP_USER" || "$APP_USER" == "root" ]]; then
  APP_USER="$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo root)"
fi
# Fallback for common EC2 users if project is owned by root
if [[ "$APP_USER" == "root" ]]; then
  for u in ec2-user ubuntu admin; do
    id "$u" &>/dev/null && APP_USER="$u" && break
  done
fi
APP_HOME="$(eval echo "~$APP_USER")"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ProMove — EC2 Auto-Deployment Script                 ║"
echo "║   Node 20 · Redis (local) · Nginx · PM2 · 4 processes        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
info "Project root : $APP_DIR"
info "Running as   : $APP_USER (home: $APP_HOME)"

# ─── OS Detection ─────────────────────────────────────────────────────────────
step "Detecting operating system"

if [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_VERSION="${VERSION_ID:-unknown}"
else
  OS_ID="unknown"; OS_VERSION="unknown"
fi

case "$OS_ID" in
  amzn)        PKG_MGR="dnf";  log "Amazon Linux $OS_VERSION" ;;
  ubuntu|debian) PKG_MGR="apt"; log "Ubuntu/Debian $OS_VERSION" ;;
  centos|rhel|fedora|rocky|almalinux) PKG_MGR="dnf"; log "RHEL-family $OS_VERSION" ;;
  *)           PKG_MGR="apt";  warn "Unknown OS '$OS_ID' — attempting apt-based install" ;;
esac

# ─── Collect configuration ────────────────────────────────────────────────────
step "Collecting configuration"

prompt_required() {
  local var="$1" prompt_text="$2"
  if [[ -n "${!var:-}" ]]; then
    log "$var is set"
    return
  fi
  local val=""
  while [[ -z "$val" ]]; do
    read -rp "$(echo -e "${YELLOW}?${NC} $prompt_text: ")" val
    [[ -z "$val" ]] && warn "Required — cannot be empty."
  done
  printf -v "$var" '%s' "$val"
}

prompt_optional() {
  local var="$1" prompt_text="$2" default="$3"
  if [[ -n "${!var:-}" ]]; then
    log "$var is set"
    return
  fi
  read -rp "$(echo -e "${YELLOW}?${NC} $prompt_text [${default}]: ")" val
  printf -v "$var" '%s' "${val:-$default}"
}

prompt_required PUBLIC_HOST   "EC2 public IP or domain name (e.g. 13.234.56.78 or api.myapp.com)"
prompt_required MONGODB_URI   "MongoDB URI (Atlas: mongodb+srv://... or local: mongodb://127.0.0.1:27017/promove)"
prompt_optional FROM_EMAIL    "From email address" "noreply@localhost.local"
prompt_optional MAIL_TRANSPORT "Mail transport (ses|smtp|json)" "json"

# Optional AWS S3
: "${AWS_REGION:=ap-south-1}"
: "${AWS_S3_BUCKET_NAME:=}"
: "${AWS_S3_PUBLIC_BASE_URL:=}"
: "${AWS_ACCESS_KEY_ID:=}"
: "${AWS_SECRET_ACCESS_KEY:=}"

PUBLIC_URL="http://${PUBLIC_HOST}"

echo ""
log "Public URL     : $PUBLIC_URL"
log "Mail transport : $MAIL_TRANSPORT"
[[ -n "$AWS_S3_BUCKET_NAME" ]] && log "S3 bucket      : $AWS_S3_BUCKET_NAME" || warn "S3 not configured — file uploads disabled"
echo ""

# ─── System packages ──────────────────────────────────────────────────────────
step "Installing system packages"

if [[ "$PKG_MGR" == "apt" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    curl git openssl build-essential libssl-dev \
    ca-certificates gnupg lsb-release >/dev/null
  log "apt packages ready"
else
  dnf update -y -q
  dnf groupinstall -y -q "Development Tools" >/dev/null 2>&1 || true
  dnf install -y -q curl git openssl openssl-libs ca-certificates >/dev/null
  log "dnf packages ready"
fi

# ─── Node.js 20 ───────────────────────────────────────────────────────────────
step "Installing Node.js $NODE_MAJOR"

install_nodejs() {
  info "Installing Node.js $NODE_MAJOR via NodeSource..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs >/dev/null
  else
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
    dnf install -y -q nodejs >/dev/null
  fi
}

if command -v node &>/dev/null; then
  CURRENT_NODE="$(node --version | sed 's/v//' | cut -d. -f1)"
  if [[ "$CURRENT_NODE" -ge "$NODE_MAJOR" ]]; then
    log "Node.js $(node --version) already installed"
  else
    warn "Node.js $(node --version) found but v$NODE_MAJOR+ required — upgrading"
    install_nodejs
  fi
else
  install_nodejs
fi
log "Node.js $(node --version) ready"

# Ensure npm is up to date
npm install -g npm@latest --silent 2>/dev/null || true

# ─── PM2 ──────────────────────────────────────────────────────────────────────
step "Installing PM2"
if command -v pm2 &>/dev/null; then
  log "PM2 $(pm2 --version) already installed"
else
  npm install -g pm2 --silent
  log "PM2 $(pm2 --version) installed"
fi

# ─── Redis ────────────────────────────────────────────────────────────────────
step "Installing Redis"

install_redis() {
  if [[ "$PKG_MGR" == "apt" ]]; then
    apt-get install -y -qq redis-server >/dev/null
  else
    # Try redis7 first (Amazon Linux 2023), then redis
    dnf install -y -q redis7 >/dev/null 2>&1 || dnf install -y -q redis >/dev/null
  fi
}

if command -v redis-server &>/dev/null; then
  log "Redis already installed: $(redis-server --version | awk '{print $3}')"
else
  install_redis
  log "Redis installed"
fi

step "Configuring Redis (local, 127.0.0.1 only)"

# Find the redis config file
REDIS_CONF=""
for f in /etc/redis/redis.conf /etc/redis.conf /etc/redis7/redis.conf; do
  [[ -f "$f" ]] && REDIS_CONF="$f" && break
done
if [[ -z "$REDIS_CONF" ]]; then
  mkdir -p /etc/redis
  REDIS_CONF="/etc/redis/redis.conf"
fi

# Backup original
[[ -f "$REDIS_CONF" && ! -f "${REDIS_CONF}.orig" ]] && cp "$REDIS_CONF" "${REDIS_CONF}.orig"

# Ensure redis user and directories exist
id redis &>/dev/null || useradd -r -s /bin/false -d /var/lib/redis redis
mkdir -p /var/lib/redis /var/log/redis
chown redis:redis /var/lib/redis /var/log/redis
chmod 750 /var/lib/redis

cat > "$REDIS_CONF" <<REOF
# ProMove local Redis — bound to 127.0.0.1 only
bind 127.0.0.1
port ${REDIS_PORT}
protected-mode yes
daemonize no
supervised auto

# Persistence
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-use-rdb-preamble yes
save 900 1
save 300 10
save 60 10000
dbfilename dump.rdb
dir /var/lib/redis

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Network
tcp-keepalive 300
timeout 0
hz 10

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
REOF

# Detect systemd service name and restart Redis
REDIS_SERVICE=""
for svc in redis-server redis7 redis; do
  if systemctl cat "${svc}.service" &>/dev/null; then
    REDIS_SERVICE="$svc"
    break
  fi
done

if [[ -n "$REDIS_SERVICE" ]]; then
  systemctl enable "$REDIS_SERVICE"
  systemctl restart "$REDIS_SERVICE"
else
  # Fallback: create a basic systemd unit
  cat > /etc/systemd/system/redis.service <<SEOF
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/bin/redis-server ${REDIS_CONF}
ExecStop=/usr/bin/redis-cli shutdown
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SEOF
  REDIS_SERVICE="redis"
  systemctl daemon-reload
  systemctl enable redis
  systemctl start redis
fi

# Wait for Redis to be ready (max 15s)
REDIS_OK=false
for i in {1..15}; do
  if redis-cli -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
    REDIS_OK=true; break
  fi
  sleep 1
done
$REDIS_OK || die "Redis failed to start. Check: journalctl -u $REDIS_SERVICE"
log "Redis is running on 127.0.0.1:$REDIS_PORT"

# ─── Nginx ────────────────────────────────────────────────────────────────────
step "Installing Nginx"

if command -v nginx &>/dev/null; then
  log "Nginx already installed"
else
  if [[ "$PKG_MGR" == "apt" ]]; then
    apt-get install -y -qq nginx >/dev/null
  else
    dnf install -y -q nginx >/dev/null
  fi
  log "Nginx installed"
fi

# ─── Generate JWT RSA-2048 keys ───────────────────────────────────────────────
step "Generating JWT RSA-2048 key pairs"

JWT_TMPFILE="$(mktemp /tmp/promove-jwt-XXXXXX.json)"
trap 'rm -f "$JWT_TMPFILE"' EXIT

node - <<'JSEOF' > "$JWT_TMPFILE"
'use strict';
const { generateKeyPairSync } = require('crypto');
const esc = (kp) =>
  kp.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n');
const { privateKey: ak } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: rk } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.stdout.write(JSON.stringify({ access: esc(ak), refresh: esc(rk) }) + '\n');
JSEOF

JWT_ACCESS_SECRET="$(node -e "process.stdout.write(require('${JWT_TMPFILE}').access)")"
JWT_REFRESH_SECRET="$(node -e "process.stdout.write(require('${JWT_TMPFILE}').refresh)")"
rm -f "$JWT_TMPFILE"
trap - EXIT
log "RSA-2048 key pairs generated"

# ─── Server/.env ──────────────────────────────────────────────────────────────
step "Creating Server/.env"

[[ -f "$SERVER_DIR/.env" ]] && {
  cp "$SERVER_DIR/.env" "$SERVER_DIR/.env.bak.$(date +%Y%m%d%H%M%S)"
  warn "Existing Server/.env backed up"
}

cat > "$SERVER_DIR/.env" <<ENVEOF
# ProMove Server — EC2 local deployment
# Generated by deploy-ec2.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# DO NOT commit this file. Permissions: 600.

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
NODE_ENV=production
PORT=${PORT_API}
CLIENT_URL=${PUBLIC_URL}
ALLOWED_ORIGINS=${PUBLIC_URL},http://localhost:5173
RATE_LIMIT_ENABLED=true
BCRYPT_ROUNDS=12
MAX_INFLIGHT_REQUESTS=1000

# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------
MONGODB_URI=${MONGODB_URI}
MONGO_MAX_POOL_SIZE=20
MONGO_MIN_POOL_SIZE=2

# ---------------------------------------------------------------------------
# Redis — local (127.0.0.1:${REDIS_PORT}, no TLS, no auth token)
# ---------------------------------------------------------------------------
AWS_REDIS_HOST=127.0.0.1
AWS_REDIS_PORT=${REDIS_PORT}
AWS_REDIS_TLS=false
REDIS_REQUEST_TIMEOUT_MS=2000
REDIS_REQUEST_RETRIES=3
BULLMQ_USE_REDIS=true
BULLMQ_CONNECT_TIMEOUT_MS=5000
BULLMQ_COMMAND_TIMEOUT_MS=5000

# ---------------------------------------------------------------------------
# JWT — locally generated RSA-2048 keys (EC2 deployment)
# ---------------------------------------------------------------------------
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d
AUTH_ALLOW_REDIS_AUTH_FALLBACK=false

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
MAIL_TRANSPORT=${MAIL_TRANSPORT}
FROM_EMAIL=${FROM_EMAIL}

# ---------------------------------------------------------------------------
# AWS / S3 (set bucket vars to enable file uploads)
# ---------------------------------------------------------------------------
AWS_REGION=${AWS_REGION}
ENVEOF

if [[ -n "$AWS_S3_BUCKET_NAME" ]]; then
  cat >> "$SERVER_DIR/.env" <<ENVEOF
AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME}
AWS_S3_PUBLIC_BASE_URL=${AWS_S3_PUBLIC_BASE_URL}
ENVEOF
fi

if [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
  cat >> "$SERVER_DIR/.env" <<ENVEOF
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENVEOF
fi

cat >> "$SERVER_DIR/.env" <<ENVEOF

# ---------------------------------------------------------------------------
# Dedicated process ports
# ---------------------------------------------------------------------------
WORKER_METRICS_PORT=${PORT_WORKER_METRICS}
SCHEDULER_HEALTH_PORT=${PORT_SCHEDULER_HEALTH}
SCHEDULER_RESCHEDULE_INTERVAL_MS=3600000
ENVEOF

chown "$APP_USER:$APP_USER" "$SERVER_DIR/.env"
chmod 600 "$SERVER_DIR/.env"
log "Server/.env created (permissions: 600)"

# ─── Client .env.production ───────────────────────────────────────────────────
step "Creating Client/.env.production"

cat > "$CLIENT_DIR/.env.production" <<ENVEOF
# ProMove Client — EC2 production build
# Generated by deploy-ec2.sh — do not edit manually.
# Nginx routes /api/* → API server and /socket.io/* → Realtime server.
VITE_API_BASE_URL=${PUBLIC_URL}
VITE_SOCKET_URL=${PUBLIC_URL}
ENVEOF

chown "$APP_USER:$APP_USER" "$CLIENT_DIR/.env.production"
log "Client/.env.production → $PUBLIC_URL"

# ─── Install Server dependencies ──────────────────────────────────────────────
step "Installing Server npm dependencies"
cd "$SERVER_DIR"
sudo -u "$APP_USER" npm ci --prefer-offline --no-audit --no-fund 2>&1 | \
  grep -E '(added|updated|error|warn)' || true
log "Server dependencies installed"

# ─── Build Server (TypeScript) ────────────────────────────────────────────────
step "Building Server (TypeScript → dist/)"
cd "$SERVER_DIR"
sudo -u "$APP_USER" npm run build
log "Server compiled → dist/src/"

# ─── Install Client dependencies ──────────────────────────────────────────────
step "Installing Client npm dependencies"
cd "$CLIENT_DIR"
sudo -u "$APP_USER" npm ci --prefer-offline --no-audit --no-fund 2>&1 | \
  grep -E '(added|updated|error|warn)' || true
log "Client dependencies installed"

# ─── Build Client (Vite) ──────────────────────────────────────────────────────
step "Building Client (Vite → dist/)"
cd "$CLIENT_DIR"
sudo -u "$APP_USER" npm run build
log "Client built → Client/dist/"

# ─── PM2 ecosystem config ─────────────────────────────────────────────────────
step "Creating PM2 ecosystem.config.js"

mkdir -p /var/log/promove
chown "$APP_USER:$APP_USER" /var/log/promove

ECOSYSTEM="$APP_DIR/ecosystem.config.js"

cat > "$ECOSYSTEM" <<PMEOF
// ProMove PM2 ecosystem — EC2 local deployment
// Generated by deploy-ec2.sh — restart with: pm2 reload ecosystem.config.js
'use strict';

module.exports = {
  apps: [
    // ── REST API ─────────────────────────────────────────────────────────────
    {
      name: 'promove-api',
      script: 'dist/src/api.js',
      cwd: '${SERVER_DIR}',
      instances: 1,
      exec_mode: 'fork',
      env_file: '${SERVER_DIR}/.env',
      env: { NODE_ENV: 'production', PORT: ${PORT_API} },
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      error_file: '/var/log/promove/api-error.log',
      out_file: '/var/log/promove/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    // ── Socket.IO Realtime ────────────────────────────────────────────────────
    {
      name: 'promove-realtime',
      script: 'dist/src/realtime.js',
      cwd: '${SERVER_DIR}',
      instances: 1,
      exec_mode: 'fork',
      env_file: '${SERVER_DIR}/.env',
      env: { NODE_ENV: 'production', PORT: ${PORT_REALTIME} },
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      error_file: '/var/log/promove/realtime-error.log',
      out_file: '/var/log/promove/realtime-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    // ── BullMQ Worker ─────────────────────────────────────────────────────────
    {
      name: 'promove-worker',
      script: 'dist/src/worker.js',
      cwd: '${SERVER_DIR}',
      instances: 1,
      exec_mode: 'fork',
      env_file: '${SERVER_DIR}/.env',
      env: { NODE_ENV: 'production', WORKER_METRICS_PORT: ${PORT_WORKER_METRICS} },
      max_memory_restart: '384M',
      restart_delay: 5000,
      max_restarts: 10,
      error_file: '/var/log/promove/worker-error.log',
      out_file: '/var/log/promove/worker-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    // ── BullMQ Scheduler (must be exactly 1 instance) ─────────────────────────
    {
      name: 'promove-scheduler',
      script: 'dist/src/scheduler.js',
      cwd: '${SERVER_DIR}',
      instances: 1,
      exec_mode: 'fork',
      env_file: '${SERVER_DIR}/.env',
      env: { NODE_ENV: 'production', SCHEDULER_HEALTH_PORT: ${PORT_SCHEDULER_HEALTH} },
      max_memory_restart: '128M',
      restart_delay: 5000,
      max_restarts: 5,
      error_file: '/var/log/promove/scheduler-error.log',
      out_file: '/var/log/promove/scheduler-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
PMEOF

chown "$APP_USER:$APP_USER" "$ECOSYSTEM"
log "ecosystem.config.js created"

# ─── Nginx reverse proxy config ───────────────────────────────────────────────
step "Configuring Nginx"

# Choose config directory (sites-available or conf.d)
if [[ -d /etc/nginx/sites-available ]]; then
  NGINX_CONF_DIR="/etc/nginx/sites-available"
  NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
else
  NGINX_CONF_DIR="/etc/nginx/conf.d"
  NGINX_ENABLED_DIR=""
fi

NGINX_CONF="$NGINX_CONF_DIR/promove.conf"

cat > "$NGINX_CONF" <<NGINXEOF
# ProMove — Nginx reverse proxy
# Generated by deploy-ec2.sh

upstream promove_api {
    server 127.0.0.1:${PORT_API};
    keepalive 32;
}

upstream promove_realtime {
    server 127.0.0.1:${PORT_REALTIME};
    keepalive 32;
}

server {
    listen ${NGINX_PORT};
    server_name ${PUBLIC_HOST} _;

    # Security headers
    add_header X-Frame-Options       "SAMEORIGIN"                            always;
    add_header X-Content-Type-Options "nosniff"                              always;
    add_header X-XSS-Protection      "1; mode=block"                        always;
    add_header Referrer-Policy       "strict-origin-when-cross-origin"      always;

    client_max_body_size   50m;
    client_body_buffer_size 128k;

    # ── Socket.IO — realtime server on :${PORT_REALTIME} ─────────────────────
    location /socket.io/ {
        proxy_pass         http://promove_realtime;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ── REST API — api server on :${PORT_API} ────────────────────────────────
    location /api/ {
        proxy_pass         http://promove_api;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Connection        "";
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # ── Health & metrics endpoints (proxied to API) ───────────────────────────
    location ~ ^/(health|healthz|readyz|metrics)$ {
        proxy_pass         http://promove_api;
        proxy_http_version 1.1;
        proxy_set_header   Host            \$host;
        proxy_set_header   X-Real-IP       \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # ── React SPA — serve static build, fallback to index.html ───────────────
    location / {
        root  ${CLIENT_DIR}/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # Long-term cache for hashed assets (Vite adds content hashes)
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }

    # Gzip compression
    gzip            on;
    gzip_vary       on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/json application/javascript application/xml+rss
        application/atom+xml image/svg+xml;
}
NGINXEOF

# Enable for sites-available setups
if [[ -n "$NGINX_ENABLED_DIR" ]]; then
  ln -sf "$NGINX_CONF" "$NGINX_ENABLED_DIR/promove.conf"
  rm -f "$NGINX_ENABLED_DIR/default" 2>/dev/null || true
fi

# Disable default conf.d/default.conf if present
[[ -f /etc/nginx/conf.d/default.conf ]] && \
  mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled 2>/dev/null || true

nginx -t || die "Nginx config test failed — check $NGINX_CONF"
systemctl enable nginx
systemctl restart nginx
log "Nginx configured and running on port $NGINX_PORT"

# ─── Start PM2 processes ──────────────────────────────────────────────────────
step "Starting PM2 processes"

# Gracefully stop any existing processes
sudo -u "$APP_USER" pm2 delete all 2>/dev/null || true

cd "$APP_DIR"
sudo -u "$APP_USER" pm2 start "$ECOSYSTEM"
sudo -u "$APP_USER" pm2 save
log "All 4 processes started via PM2"

# Setup PM2 to survive reboots
STARTUP_CMD="$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" 2>&1 | grep '^sudo')"
if [[ -n "$STARTUP_CMD" ]]; then
  eval "$STARTUP_CMD" || warn "PM2 startup script install failed — run manually: $STARTUP_CMD"
  log "PM2 configured to start on boot"
fi

# ─── Firewall ─────────────────────────────────────────────────────────────────
step "Configuring firewall (best effort)"

if command -v ufw &>/dev/null; then
  ufw allow 22/tcp   >/dev/null 2>&1 || true
  ufw allow 80/tcp   >/dev/null 2>&1 || true
  ufw allow 443/tcp  >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
  log "ufw: ports 22/80/443 allowed"
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-service=ssh   >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=http  >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
  log "firewalld: ssh/http/https allowed"
else
  warn "No firewall tool found — ensure the EC2 Security Group allows port 80 (and 443 for SSL)"
fi

# ─── Health verification ──────────────────────────────────────────────────────
step "Verifying deployment health"
info "Waiting 8 seconds for processes to initialize..."
sleep 8

check_endpoint() {
  local url="$1" label="$2"
  if curl -sf --max-time 8 "$url" &>/dev/null; then
    log "$label responded OK  →  $url"
  else
    warn "$label not yet responding — it may still be starting up"
    warn "Check logs: sudo -u $APP_USER pm2 logs $label"
  fi
}

check_endpoint "http://127.0.0.1:${PORT_API}/healthz"       "promove-api"
check_endpoint "http://127.0.0.1:${PORT_REALTIME}/healthz"  "promove-realtime"
check_endpoint "http://127.0.0.1:${NGINX_PORT}/"            "nginx-frontend"

# ─── Final summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ProMove Deployment Complete!                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${BOLD}App URL:${NC}         ${PUBLIC_URL}"
echo -e "  ${BOLD}API:${NC}             ${PUBLIC_URL}/api/"
echo -e "  ${BOLD}Health:${NC}          ${PUBLIC_URL}/healthz"
echo -e "  ${BOLD}Readiness:${NC}       ${PUBLIC_URL}/readyz"
echo ""
echo -e "  ${BOLD}Redis:${NC}           127.0.0.1:${REDIS_PORT}  (local, no TLS)"
echo -e "  ${BOLD}API server:${NC}      127.0.0.1:${PORT_API}"
echo -e "  ${BOLD}Realtime server:${NC} 127.0.0.1:${PORT_REALTIME}"
echo ""
echo -e "  ${BOLD}PM2 status:${NC}      sudo -u ${APP_USER} pm2 status"
echo -e "  ${BOLD}PM2 logs:${NC}        sudo -u ${APP_USER} pm2 logs"
echo -e "  ${BOLD}Restart all:${NC}     sudo -u ${APP_USER} pm2 restart all"
echo -e "  ${BOLD}App logs:${NC}        ls /var/log/promove/"
echo ""

if [[ "$MAIL_TRANSPORT" == "json" ]]; then
  warn "MAIL_TRANSPORT=json — emails are logged to stdout only, not actually sent."
  warn "Update Server/.env: MAIL_TRANSPORT=ses (or smtp) for real email delivery."
fi
[[ -z "$AWS_S3_BUCKET_NAME" ]] && \
  warn "S3 not configured — file/image uploads will fail. Set AWS_S3_BUCKET_NAME in Server/.env."
echo ""
info "To redeploy after code changes, run:"
info "  cd $SERVER_DIR && sudo -u $APP_USER npm run build"
info "  cd $CLIENT_DIR && sudo -u $APP_USER npm run build"
info "  sudo -u $APP_USER pm2 reload all"
echo ""

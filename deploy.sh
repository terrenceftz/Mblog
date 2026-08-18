#!/usr/bin/env bash
# ============================================================
# MBLOG 生产部署脚本（cs.mboker.cn 宿主 Nginx + PM2 形态）
#
# 用法：
#   ./deploy.sh backend   # 后端：打包 src/scripts/package.json → scp → npm install → 重启 mblog-api
#   ./deploy.sh site      # 前台：本地构建 dist → tar → scp → 备份旧目录 → 覆盖 → 重启 mblog-site
#   ./deploy.sh admin     # 后台：本地构建 dist → tar → scp → 备份旧目录 → 覆盖（静态文件无需重启）
#   ./deploy.sh all       # 三者全跑
#
# 环境变量（均有默认值，默认值 = 2026-08 实测服务器）：
#   DEPLOY_SERVER      ssh 目标           默认 ubuntu@49.235.112.36
#   DEPLOY_SSH_KEY     ssh 私钥路径        默认 ~/.ssh/id_rsa（或桌面 ssh812.pem 自行指定）
#   DEPLOY_BACKEND_DIR 服务器后端目录      默认 /root/.openclaw/workspace/agent-e7b30f31/mblog/backend
#   DEPLOY_SITE_DIR    服务器前台目录      默认 /root/.openclaw/workspace/agent-e7b30f31/mblog/site
#   DEPLOY_ADMIN_DIR   服务器后台静态目录   默认 /var/www/cs.mboker.cn/admin
#   DEPLOY_NODE_BIN    服务器 v22 node 目录 默认 /root/.nvm/versions/node/v22.22.2/bin
#
# ⚠️ 关键坑（踩过两次）：pm2 restart --update-env 会刷新进程 env，若在默认 PATH 下执行，
#    node 会被解析成系统旧版（v18）→ better-sqlite3 ABI 不匹配 502。
#    必须 `sudo bash -c 'export PATH=...:$PATH && pm2 restart ...'`——sudo 会重置 PATH，
#    仅写 pm2 绝对路径不够。本脚本已固化该姿势，勿手改。
# ============================================================
set -euo pipefail

SERVER="${DEPLOY_SERVER:-ubuntu@49.235.112.36}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_rsa}"
BACKEND_DIR="${DEPLOY_BACKEND_DIR:-/root/.openclaw/workspace/agent-e7b30f31/mblog/backend}"
SITE_DIR="${DEPLOY_SITE_DIR:-/root/.openclaw/workspace/agent-e7b30f31/mblog/site}"
ADMIN_DIR="${DEPLOY_ADMIN_DIR:-/var/www/cs.mboker.cn/admin}"
NODE_BIN="${DEPLOY_NODE_BIN:-/root/.nvm/versions/node/v22.22.2/bin}"

SSH="ssh -i $KEY -o StrictHostKeyChecking=no"
SCP="scp -i $KEY -o StrictHostKeyChecking=no"
# 固定 PM2 重启姿势（见头部警示）
PM2_RESTART="sudo bash -c 'export PATH=$NODE_BIN:\$PATH && pm2 restart"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m部署失败: %s\033[0m\n' "$*" >&2; exit 1; }

health_check() {
  local url="$1" what="$2"
  say "健康检查 $what ..."
  $SSH "$SERVER" "curl -sf -o /dev/null -w '%{http_code}' '$url'" || die "$what 未通过健康检查"
}

deploy_backend() {
  say "[backend] 打包源码（排除 node_modules/data/uploads）"
  tar -cf /tmp/mblog-backend.tar \
    --exclude=node_modules --exclude=data --exclude=uploads --exclude=backups --exclude=test \
    -C backend src package.json package-lock.json tsconfig.json drizzle scripts
  say "[backend] 上传到 $SERVER:$BACKEND_DIR"
  $SCP /tmp/mblog-backend.tar "$SERVER:/tmp/mblog-backend.tar"
  $SSH "$SERVER" "sudo bash -c 'cd $BACKEND_DIR && tar -xf /tmp/mblog-backend.tar && rm /tmp/mblog-backend.tar'"
  say "[backend] 安装新增依赖 nodemailer（纯 JS 无编译；不跑全量 npm install，避免动 esbuild/tsx——服务器 tsx 靠 npx 缓存运行）"
  $SSH "$SERVER" "sudo bash -c 'export PATH=$NODE_BIN:\$PATH && cd $BACKEND_DIR && npm install nodemailer@^6.10.1'"
  say "[backend] 重启 mblog-api"
  $SSH "$SERVER" "$PM2_RESTART mblog-api --update-env'"
  sleep 3
  health_check "http://localhost:3003/api/health" "backend"
}

deploy_site() {
  say "[site] 本地构建 dist"
  (cd site && npm run build) || die "site 构建失败"
  tar -cf /tmp/mblog-site-dist.tar -C site/dist .
  say "[site] 上传 dist 到 $SERVER"
  $SCP /tmp/mblog-site-dist.tar "$SERVER:/tmp/mblog-site-dist.tar"
  $SSH "$SERVER" "sudo bash -c 'cd $SITE_DIR && rm -rf dist.bak && mv dist dist.bak 2>/dev/null; mkdir dist && tar -xf /tmp/mblog-site-dist.tar -C dist && rm /tmp/mblog-site-dist.tar'"
  say "[site] 重启 mblog-site"
  $SSH "$SERVER" "$PM2_RESTART mblog-site --update-env'"
  sleep 3
  health_check "https://cs.mboker.cn/" "site"
}

deploy_admin() {
  say "[admin] 本地构建 dist"
  (cd admin && npm run build) || die "admin 构建失败"
  tar -cf /tmp/mblog-admin-dist.tar -C admin/dist .
  say "[admin] 上传 dist 到 $SERVER:$ADMIN_DIR"
  $SCP /tmp/mblog-admin-dist.tar "$SERVER:/tmp/mblog-admin-dist.tar"
  $SSH "$SERVER" "sudo bash -c 'cd / && rm -rf $ADMIN_DIR.bak && mv $ADMIN_DIR $ADMIN_DIR.bak 2>/dev/null; mkdir -p $ADMIN_DIR && tar -xf /tmp/mblog-admin-dist.tar -C $ADMIN_DIR && rm /tmp/mblog-admin-dist.tar'"
  say "[admin] 静态文件已替换（无需重启）"
  health_check "https://cs.mboker.cn/admin/login" "admin"
}

MODE="${1:-all}"
case "$MODE" in
  backend) deploy_backend ;;
  site)    deploy_site ;;
  admin)   deploy_admin ;;
  all)     deploy_backend; deploy_site; deploy_admin ;;
  *) die "未知模式: $MODE（可用 backend|site|admin|all）" ;;
esac

say "部署完成 ✅"

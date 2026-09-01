#!/usr/bin/env bash
set -uo pipefail

# The exported proxy variables can go stale when the proxy client changes port,
# so try them first, then the port macOS is actually configured to use, then a
# direct connection. Without this git spends its whole timeout on a dead port.
reachable() {
  nc -z -G 2 "$1" "$2" 2>/dev/null
}

use_proxy() {
  export http_proxy="http://$1:$2" https_proxy="http://$1:$2" all_proxy="http://$1:$2"
  export HTTP_PROXY="$http_proxy" HTTPS_PROXY="$https_proxy" ALL_PROXY="$all_proxy"
}

env_host="" env_port=""
for var in https_proxy HTTPS_PROXY http_proxy HTTP_PROXY all_proxy ALL_PROXY; do
  value="${!var:-}"
  if [ -n "$value" ]; then
    value="${value#*://}"
    value="${value%%/*}"
    env_host="${value%:*}"
    env_port="${value##*:}"
    break
  fi
done

sys_host=$(scutil --proxy | awk '/HTTPProxy/ {print $3}')
sys_port=$(scutil --proxy | awk '/HTTPPort/ {print $3}')

if [ -n "$env_host" ] && reachable "$env_host" "$env_port"; then
  echo "push.sh: using proxy $env_host:$env_port"
elif [ -n "$sys_host" ] && reachable "$sys_host" "$sys_port"; then
  echo "push.sh: proxy $env_host:$env_port unreachable, using system proxy $sys_host:$sys_port"
  use_proxy "$sys_host" "$sys_port"
else
  echo "push.sh: no working proxy, trying a direct connection"
  unset https_proxy HTTPS_PROXY http_proxy HTTP_PROXY all_proxy ALL_PROXY
  # git 2.39 has no connect timeout knob, so probe here instead of letting the
  # push stall for 75s when GitHub is blocked on a direct connection.
  if ! reachable github.com 443; then
    echo "push.sh: github.com:443 unreachable and no proxy is running; start your proxy and retry" >&2
    exit 1
  fi
fi

git add .

if git diff --cached --quiet; then
  echo "push.sh: nothing new to commit"
else
  git commit -m "update"
fi

git push --force-with-lease

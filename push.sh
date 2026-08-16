#!/usr/bin/env bash
set -uo pipefail

# The shell environment may point git at a local proxy (e.g. Clash on :7890)
# that is not always running. Fall back to a direct connection when the proxy
# port is not accepting connections, otherwise git fails before reaching GitHub.
proxy_host_port=""
for var in https_proxy HTTPS_PROXY http_proxy HTTP_PROXY all_proxy ALL_PROXY; do
  value="${!var:-}"
  if [ -n "$value" ]; then
    proxy_host_port="${value#*://}"
    proxy_host_port="${proxy_host_port%%/*}"
    break
  fi
done

if [ -n "$proxy_host_port" ]; then
  proxy_host="${proxy_host_port%:*}"
  proxy_port="${proxy_host_port##*:}"
  if ! nc -z -G 2 "$proxy_host" "$proxy_port" 2>/dev/null; then
    echo "push.sh: proxy $proxy_host:$proxy_port unreachable, pushing without proxy"
    unset https_proxy HTTPS_PROXY http_proxy HTTP_PROXY all_proxy ALL_PROXY
  fi
fi

git add .

if git diff --cached --quiet; then
  echo "push.sh: nothing new to commit"
else
  git commit -m "update"
fi

git push --force-with-lease

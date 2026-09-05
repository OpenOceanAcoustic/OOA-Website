#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"

action="${1:-start}"
port="${2:-50001}"
public_host="${OOA_PUBLIC_HOST:-120.25.227.174}"
runtime_root="${OOA_RUNTIME_ROOT:-/tmp/ooa-website-${UID}}"
pid_file="${runtime_root}/public-${port}.pid"
log_file="${runtime_root}/public-${port}.log"

usage() {
  cat <<'EOF'
Usage: scripts/serve-public.sh [command] [port]

Commands:
  start    Start the public Vite server (default)
  stop     Stop the server managed by this script
  restart  Restart the managed server
  status   Show process and HTTP status
  logs     Print the latest 100 log lines
  follow   Follow the server log (Ctrl+C only stops log following)
  help     Show this help

Defaults:
  port:        50001
  public host: 120.25.227.174

Examples:
  bash scripts/serve-public.sh start
  bash scripts/serve-public.sh restart 50002
  OOA_PUBLIC_HOST=example.com bash scripts/serve-public.sh status
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

validate_port() {
  [[ "${port}" =~ ^[0-9]+$ ]] || fail "port must be an integer: ${port}"
  local numeric_port=$((10#${port}))
  ((numeric_port >= 1 && numeric_port <= 65535)) || fail "port must be between 1 and 65535: ${port}"
}

managed_pid() {
  [[ -f "${pid_file}" ]] || return 1
  local pid
  pid="$(<"${pid_file}")"
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  kill -0 "${pid}" 2>/dev/null || return 1

  local command_line process_cwd
  command_line="$(tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null || true)"
  process_cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
  [[ "${command_line}" == *"npm run dev"* && "${process_cwd}" == "${project_root}" ]] || return 1
  printf '%s\n' "${pid}"
}

port_is_busy() {
  command -v ss >/dev/null 2>&1 || return 1
  [[ -n "$(ss -ltnH "sport = :${port}" 2>/dev/null || true)" ]]
}

wait_for_http() {
  command -v curl >/dev/null 2>&1 || return 0
  local attempt
  for attempt in {1..40}; do
    if curl --silent --fail --max-time 1 "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

start_server() {
  local pid
  if pid="$(managed_pid)"; then
    echo "OOA Website is already running (PID ${pid})."
    echo "Public URL: http://${public_host}:${port}/"
    return 0
  fi

  mkdir -p "${runtime_root}"
  rm -f -- "${pid_file}"
  port_is_busy && fail "port ${port} is already in use by a process not managed by this script"
  command -v npm >/dev/null 2>&1 || fail "npm was not found"
  [[ -d "${project_root}/node_modules" ]] || fail "dependencies are missing; run 'npm install' in ${project_root}"

  cd "${project_root}"
  nohup setsid npm run dev --workspace @ooa/web -- \
    --host 0.0.0.0 --port "${port}" >"${log_file}" 2>&1 < /dev/null &
  pid=$!
  printf '%s\n' "${pid}" > "${pid_file}"

  if ! wait_for_http; then
    echo "Server failed to become ready. Recent log output:" >&2
    tail -n 40 "${log_file}" >&2 || true
    exit 1
  fi

  echo "OOA Website started (PID ${pid})."
  echo "Local URL:  http://127.0.0.1:${port}/"
  echo "Public URL: http://${public_host}:${port}/"
  echo "Log file:   ${log_file}"
}

stop_server() {
  local pid
  if ! pid="$(managed_pid)"; then
    rm -f -- "${pid_file}"
    echo "OOA Website is not running under this script on port ${port}."
    return 0
  fi

  kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
  local attempt
  for attempt in {1..20}; do
    kill -0 "${pid}" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "${pid}" 2>/dev/null; then
    kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
  fi
  rm -f -- "${pid_file}"
  echo "OOA Website stopped (PID ${pid})."
}

show_status() {
  local pid
  if pid="$(managed_pid)"; then
    echo "Status:     running"
    echo "PID:        ${pid}"
    echo "Public URL: http://${public_host}:${port}/"
    echo "Log file:   ${log_file}"
    if command -v curl >/dev/null 2>&1; then
      local status_code
      status_code="$(curl --silent --output /dev/null --max-time 2 --write-out '%{http_code}' "http://127.0.0.1:${port}/" || true)"
      echo "HTTP:       ${status_code:-unreachable}"
    fi
  else
    echo "Status: stopped"
    port_is_busy && echo "Notice: port ${port} is occupied by another process."
    return 1
  fi
}

show_logs() {
  [[ -f "${log_file}" ]] || fail "no log file found for port ${port}"
  tail -n 100 "${log_file}"
}

follow_logs() {
  [[ -f "${log_file}" ]] || fail "no log file found for port ${port}"
  tail -n 100 -f "${log_file}"
}

validate_port

case "${action}" in
  start) start_server ;;
  stop) stop_server ;;
  restart)
    stop_server
    start_server
    ;;
  status) show_status ;;
  logs) show_logs ;;
  follow) follow_logs ;;
  help|-h|--help) usage ;;
  *)
    usage >&2
    fail "unknown command: ${action}"
    ;;
esac

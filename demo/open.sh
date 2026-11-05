#!/bin/zsh
# Open the demo vault in its own Obsidian instance (own data folder, DevTools port 9351).
# Your everyday Obsidian, its vaults and its settings are never touched.
#   demo/open.sh               open in the system language
#   demo/open.sh --lang en     switch the instance to en, zh or ja
#   demo/open.sh --quit        close the demo instance only
set -euo pipefail
DEMO=${0:A:h}
VAULT=${DEMO_VAULT:-$HOME/Obsidian/TaskNotes-Countdown-Demo}
DATA="$HOME/Library/Application Support/obsidian-tnc-demo"
export PORT=${PORT:-9351}
BIN=/Applications/Obsidian.app/Contents/MacOS/Obsidian
LANG_CODE=""
running() { pgrep -f -- "--user-data-dir=$DATA" >/dev/null 2>&1; }
case "${1:-}" in
  --quit)
    pkill -f -- "^$BIN --user-data-dir=$DATA" || true
    # Wait until it is really gone, so an open right after a reset starts a fresh instance.
    for i in {1..40}; do running || exit 0; sleep 0.25; done
    exit 0 ;;
  --lang) LANG_CODE=${2:?language code, e.g. en}; shift 2 ;;
esac
[[ -f "$VAULT/.tnc-demo" ]] || { echo "No demo vault at $VAULT. Run demo/reset.sh first."; exit 1; }
page_up() { curl -s "http://127.0.0.1:$PORT/json" | grep -q '"type": "page"'; }
if ! running; then
  mkdir -p "$DATA"
  print -r -- "{\"vaults\":{\"tncdemo000000001\":{\"path\":\"$VAULT\",\"ts\":$(date +%s)000,\"open\":true}}}" > "$DATA/obsidian.json"
  # Right after a quit Obsidian can refuse a new instance for a moment, so try twice.
  for attempt in 1 2; do
    nohup "$BIN" --user-data-dir="$DATA" --remote-debugging-port="$PORT" >"$DATA/launch.log" 2>&1 &!
    for i in {1..40}; do page_up && break; sleep 0.5; done
    page_up && break
    sleep 2
  done
  sleep 3
fi
ready() {
  for i in {1..60}; do
    [[ $(node "$DEMO/cdp.mjs" eval "typeof app === 'object' && app.workspace.layoutReady" 2>/dev/null) == true ]] && return 0
    sleep 0.5
  done
  echo "Obsidian did not become ready"; exit 1
}
ready
# Trust this vault's community plugins (this instance only); reload once so they load.
if [[ $(node "$DEMO/cdp.mjs" eval "localStorage.getItem('enable-plugin-' + app.appId)") != '"true"' ]]; then
  node "$DEMO/cdp.mjs" eval "localStorage.setItem('enable-plugin-' + app.appId, 'true'); setTimeout(() => location.reload(), 100); true" >/dev/null
  sleep 2; ready
fi
if [[ -n $LANG_CODE && $(node "$DEMO/cdp.mjs" eval "localStorage.getItem('language')") != "\"$LANG_CODE\"" ]]; then
  node "$DEMO/cdp.mjs" eval "localStorage.setItem('language', '$LANG_CODE'); setTimeout(() => location.reload(), 100); true" >/dev/null
  sleep 2; ready
fi
echo "Demo vault open (DevTools port $PORT)."

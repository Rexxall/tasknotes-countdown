#!/bin/zsh
# Rebuild the README art and demo GIFs from the demo vault (English interface, light and dark).
#   assets/readme/source/record.sh
set -euo pipefail
SRC=${0:A:h}
REPO=${SRC:h:h:h}
OUT=${SRC:h}
cdp() { node "$REPO/demo/cdp.mjs" "$@"; }
TMP=$(mktemp -d)
"$REPO/demo/reset.sh"
"$REPO/demo/open.sh" --lang en
cdp eval "$(cat "$SRC/setup.js")" >/dev/null
sleep 2
cdp click "1100 700"  # park the mouse away from the rows
for mode in light dark; do
  theme=$([[ $mode == light ]] && echo moonstone || echo obsidian)
  mkdir -p "$TMP/$mode"
  cdp eval "app.vault.setConfig('theme','$theme'); app.updateTheme(); true" >/dev/null
  sleep 1.5
  cdp shot2x "$TMP/$mode/start.png" >/dev/null
  cdp click "964 154"   # share button on the nearest deadline
  sleep 1.2
  cdp eval "require('fs').writeFileSync('$TMP/$mode/card.png', Buffer.from(window.__card.split(',')[1], 'base64')); window.__card = null; true" >/dev/null
  sleep 3                # let the notice go
  cdp click "22 390"    # hourglass in the ribbon
  sleep 1.5
  cdp shot2x "$TMP/$mode/sidebar.png" >/dev/null
  cdp eval "app.workspace.getLeavesOfType('tasknotes-countdown-sidebar').forEach(l => l.detach()); app.workspace.rightSplit.collapse(); true" >/dev/null
  sleep 1
done
"$REPO/demo/reset.sh"
for mode in light dark; do python3 "$SRC/make_demo.py" "$TMP/$mode" $mode "$SRC/boxes.json" "$OUT/demo-$mode.gif"; done
python3 "$SRC/make_art.py"

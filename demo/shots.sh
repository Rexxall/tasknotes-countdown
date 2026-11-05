#!/bin/zsh
# Screenshots of the open demo instance in light and dark: the Countdown base with the sidebar card.
#   demo/shots.sh <output folder>
set -euo pipefail
DEMO=${0:A:h}
OUT=${1:?output folder}
mkdir -p "$OUT"
ev() { node "$DEMO/cdp.mjs" eval "$1" >/dev/null; }
ev "(()=>{const w=require('@electron/remote').getCurrentWindow(); w.setBounds({x:80,y:60,width:1440,height:900}); w.show(); w.focus(); document.querySelectorAll('.modal-close-button').forEach(b=>b.click());})()"
ev "(async()=>{const l=app.workspace.getLeaf(false); await l.openFile(app.vault.getAbstractFileByPath('TaskNotes/Views/Countdown.base')); app.workspace.leftSplit.collapse(); app.workspace.rightSplit.expand(); const s=app.workspace.getLeavesOfType('tasknotes-countdown-sidebar')[0]; if(s) app.workspace.revealLeaf(s);})()"
for mode in light dark; do
  theme=$([[ $mode == light ]] && echo moonstone || echo obsidian)
  ev "app.vault.setConfig('theme','$theme'); app.updateTheme()"
  sleep 1.5
  node "$DEMO/cdp.mjs" shot "$OUT/countdown-$mode.png"
done
ev "app.vault.setConfig('theme','system'); app.updateTheme()"

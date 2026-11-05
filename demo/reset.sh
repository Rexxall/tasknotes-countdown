#!/bin/zsh
# Put the demo vault back to a clean start: closes the demo instance, rebuilds the vault, dates relative to today.
#   demo/reset.sh
set -euo pipefail
DEMO=${0:A:h}
REPO=${DEMO:h}
TN_VERSION=4.16.1
"$DEMO/open.sh" --quit
sleep 1
if [[ ! -f "$DEMO/.cache/tasknotes/main.js" ]]; then
  mkdir -p "$DEMO/.cache/tasknotes"
  gh release download "$TN_VERSION" -R callumalpass/tasknotes -p main.js -p manifest.json -p styles.css -D "$DEMO/.cache/tasknotes" --clobber
fi
( cd "$REPO" && npm run build --silent )
node "$DEMO/build.mjs"

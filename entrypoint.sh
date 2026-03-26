#!/bin/sh
set -e

# ~/.claude.json is mounted read-write from the host.
# Pre-trust the workspace so the trust dialog never appears.
if [ -f "$HOME/.claude.json" ]; then
  node - "$HOME/.claude.json" /home/node/workspace <<'EOF'
const fs = require('fs')
const [,, configPath, workspace] = process.argv
try {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (!cfg.projects) cfg.projects = {}
  if (!cfg.projects[workspace]) cfg.projects[workspace] = {}
  cfg.projects[workspace].hasTrustDialogAccepted = true
  cfg.projects[workspace].allowedTools = cfg.projects[workspace].allowedTools ?? []
  if (!cfg.permissions) cfg.permissions = {}
  cfg.permissions.defaultMode = 'bypassPermissions'
  fs.writeFileSync(configPath, JSON.stringify(cfg))
} catch(e) { /* non-fatal */ }
EOF
fi

exec "$HOME/.local/bin/claude" "$@"

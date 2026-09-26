#!/usr/bin/env bash
# Envoie une notification de test à Manuvers.
# Usage : scripts/notify-test.sh <sujet> [type] [titre] [message]
#   type : info | success | alerte | news (par défaut : info)
# Variables facultatives : NTFY_SERVER (par défaut https://ntfy.sh), NTFY_TOKEN (jeton d'accès)
set -euo pipefail

TOPIC="${1:?Indiquez le sujet ntfy affiché dans les réglages de Manuvers}"
TYPE="${2:-info}"
TITLE="${3:-Test Manuvers}"
MESSAGE="${4:-Ceci est une notification de test envoyée depuis le terminal.}"
SERVER="${NTFY_SERVER:-https://ntfy.sh}"

ARGS=(-sS -H "Title: ${TITLE}" -H "Tags: ${TYPE}" -d "${MESSAGE}")
if [[ -n "${NTFY_TOKEN:-}" ]]; then
  ARGS+=(-H "Authorization: Bearer ${NTFY_TOKEN}")
fi

curl "${ARGS[@]}" "${SERVER%/}/${TOPIC}" > /dev/null
echo "Notification « ${TITLE} » (${TYPE}) envoyée sur ${SERVER%/}/${TOPIC}"

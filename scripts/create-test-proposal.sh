#!/usr/bin/env bash

set -euo pipefail

# Govenr - Dash Testnet Governance Proposal Generator
#
# Usage:
#   ./scripts/create-test-proposal.sh \
#       --name govenr-test-003 \
#       --url https://govenr.dash/test/govenr-test-003
#
# Optional:
#   --payment-address <address>
#   --payment-amount <amount>
#   --start-delay <blocks>
#   --duration <blocks>
#
# IMPORTANT:
#   This script is intentionally Testnet-only.
#   It refuses to run against Mainnet.

NETWORK="testnet"
CLI="${DASH_CLI:-dash-cli}"

NAME=""
URL=""
PAYMENT_ADDRESS=""
PAYMENT_AMOUNT="1"
START_DELAY="100"
DURATION="4032"

usage() {
    cat <<EOF

Govenr Dash Testnet Proposal Generator

Usage:
  $0 --name NAME --url URL [options]

Required:
  --name NAME                 Proposal name
  --url URL                   Proposal URL

Optional:
  --payment-address ADDRESS   Dash Testnet payment address
  --payment-amount AMOUNT     Monthly payment amount (default: 1)
  --start-delay BLOCKS        Blocks before proposal starts (default: 100)
  --duration BLOCKS           Proposal duration (default: 4032)
  -h, --help                  Show this help

Environment:
  DASH_CLI                    dash-cli executable/path (default: dash-cli)

Example:
  $0 \\
    --name govenr-test-003 \\
    --url https://govenr.dash/test/govenr-test-003

EOF
}

die() {
    echo
    echo "ERROR: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "'$1' not found in PATH"
}

# ------------------------------------------------------------
# Parse arguments
# ------------------------------------------------------------

while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)
            [[ $# -ge 2 ]] || die "--name requires a value"
            NAME="$2"
            shift 2
            ;;

        --url)
            [[ $# -ge 2 ]] || die "--url requires a value"
            URL="$2"
            shift 2
            ;;

        --payment-address)
            [[ $# -ge 2 ]] || die "--payment-address requires a value"
            PAYMENT_ADDRESS="$2"
            shift 2
            ;;

        --payment-amount)
            [[ $# -ge 2 ]] || die "--payment-amount requires a value"
            PAYMENT_AMOUNT="$2"
            shift 2
            ;;

        --start-delay)
            [[ $# -ge 2 ]] || die "--start-delay requires a value"
            START_DELAY="$2"
            shift 2
            ;;

        --duration)
            [[ $# -ge 2 ]] || die "--duration requires a value"
            DURATION="$2"
            shift 2
            ;;

        -h|--help)
            usage
            exit 0
            ;;

        *)
            die "Unknown argument: $1"
            ;;
    esac
done

[[ -n "$NAME" ]] || die "--name is required"
[[ -n "$URL" ]] || die "--url is required"

require_command "$CLI"

# ------------------------------------------------------------
# Verify Testnet
# ------------------------------------------------------------

CHAIN="$("$CLI" getblockchaininfo | python3 -c '
import json
import sys
data=json.load(sys.stdin)
print(data.get("chain", ""))
')"

if [[ "$CHAIN" != "test" ]]; then
    die "This script is Testnet-only. Current chain: '$CHAIN'"
fi

echo
echo "=============================================="
echo " Govenr Testnet Proposal Generator"
echo "=============================================="
echo
echo "Network:          Testnet"
echo "Name:             $NAME"
echo "URL:              $URL"
echo "Payment amount:   $PAYMENT_AMOUNT DASH"
echo

# ------------------------------------------------------------
# Determine payment address
# ------------------------------------------------------------

if [[ -z "$PAYMENT_ADDRESS" ]]; then
    PAYMENT_ADDRESS="$("$CLI" getnewaddress "" legacy)"
fi

echo "Payment address:  $PAYMENT_ADDRESS"

# ------------------------------------------------------------
# Calculate epochs
# ------------------------------------------------------------

CURRENT_TIME="$("$CLI" getblockchaininfo | python3 -c '
import json
import sys
data=json.load(sys.stdin)
print(data["mediantime"])
')"

# Dash governance epochs are Unix timestamps.
# Use current median time + block-based delays.
#
# Approximate Dash block time: 2.5 minutes.

BLOCK_TIME=150

START_EPOCH=$((CURRENT_TIME + START_DELAY * BLOCK_TIME))
END_EPOCH=$((START_EPOCH + DURATION * BLOCK_TIME))

CREATED_AT="$(date +%s)"

# ------------------------------------------------------------
# Build proposal JSON
# ------------------------------------------------------------

PROPOSAL_JSON="$(
python3 - "$END_EPOCH" "$NAME" "$PAYMENT_ADDRESS" \
    "$PAYMENT_AMOUNT" "$START_EPOCH" "$URL" <<'PY'
import json
import sys

end_epoch = int(sys.argv[1])
name = sys.argv[2]
payment_address = sys.argv[3]
payment_amount = int(sys.argv[4])
start_epoch = int(sys.argv[5])
url = sys.argv[6]

proposal = {
    "end_epoch": end_epoch,
    "name": name,
    "payment_address": payment_address,
    "payment_amount": payment_amount,
    "start_epoch": start_epoch,
    "type": 1,
    "url": url
}

# Compact JSON is important because this exact serialization
# is what gets converted to the governance object hex.
print(json.dumps(proposal, separators=(",", ":")))
PY
)"

# ------------------------------------------------------------
# Convert JSON -> hexadecimal
# ------------------------------------------------------------

PROPOSAL_HEX="$(
printf '%s' "$PROPOSAL_JSON" |
python3 -c '
import sys
print(sys.stdin.buffer.read().hex())
'
)"

echo
echo "Proposal JSON:"
echo "$PROPOSAL_JSON"
echo
echo "Proposal hex:"
echo "$PROPOSAL_HEX"
echo

# ------------------------------------------------------------
# Prepare governance object
# ------------------------------------------------------------

echo "Preparing governance object..."

PREPARE_RESULT="$(
    "$CLI" gobject prepare \
        0 \
        1 \
        "$CREATED_AT" \
        "$PROPOSAL_HEX"
)"

echo
echo "Collateral transaction:"
echo "$PREPARE_RESULT"
echo

COLLATERAL_TXID="$PREPARE_RESULT"

# ------------------------------------------------------------
# Wait for collateral confirmation
# ------------------------------------------------------------

echo "Waiting for 6 confirmations..."
echo

while true; do
    TX_INFO="$("$CLI" getrawtransaction "$COLLATERAL_TXID" 1)"

    CONFIRMATIONS="$(
        printf '%s' "$TX_INFO" |
        python3 -c '
import json
import sys
d=json.load(sys.stdin)
print(d.get("confirmations", 0))
'
    )"

    echo "Confirmations: $CONFIRMATIONS / 6"

    if [[ "$CONFIRMATIONS" -ge 6 ]]; then
        break
    fi

    sleep 30
done

# ------------------------------------------------------------
# Submit governance object
# ------------------------------------------------------------

echo
echo "Submitting governance object..."

OBJECT_HASH="$(
    "$CLI" gobject submit \
        0 \
        1 \
        "$CREATED_AT" \
        "$PROPOSAL_HEX" \
        "$COLLATERAL_TXID"
)"

# ------------------------------------------------------------
# Verify
# ------------------------------------------------------------

echo
echo "=============================================="
echo " Proposal submitted successfully"
echo "=============================================="
echo
echo "Governance hash:"
echo "$OBJECT_HASH"
echo
echo "Collateral TX:"
echo "$COLLATERAL_TXID"
echo
echo "Proposal name:"
echo "$NAME"
echo
echo "Govenr URL:"
echo "$URL"
echo
echo "Use this hash in Govenr:"
echo
echo "  $OBJECT_HASH"
echo
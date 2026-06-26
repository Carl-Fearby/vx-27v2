#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/certificates"
KEY_FILE="${CERT_DIR}/localhost-key.pem"
CERT_FILE="${CERT_DIR}/localhost.pem"

mkdir -p "${CERT_DIR}"

if [[ -f "${KEY_FILE}" && -f "${CERT_FILE}" ]]; then
  echo "HTTPS certificates already exist in certificates/"
  exit 0
fi

echo "Generating local HTTPS certificates..."

if command -v mkcert >/dev/null 2>&1; then
  mkcert -install >/dev/null 2>&1 || true
  mkcert \
    -key-file "${KEY_FILE}" \
    -cert-file "${CERT_FILE}" \
    localhost 127.0.0.1 ::1
else
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -days 825 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"
fi

echo "HTTPS certificates ready:"
echo "  ${CERT_FILE}"
echo "  ${KEY_FILE}"

#!/usr/bin/env bash
export NODE_INSTALLATION_VERSION=$(sed 's/^v//' "$(dirname "${BASH_SOURCE[0]}")/../.nvmrc")
export REPOSITORY_RID=ri.stemma.main.repository.df713c22-d9ac-47a0-9f1f-e9315674f8e8
export REQUESTS_CA_BUNDLE=${SSL_CERT_FILE} # Used by the Python requests module

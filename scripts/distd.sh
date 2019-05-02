#!/bin/bash

set -eo pipefail

prjdir="$1"

if [[ -z $prjdir ]]; then
    echo 'Invalid project directory' >&2
    exit 1
fi

pushd "$prjdir">/dev/null
rm -rf dist/
mkdir -p dist

# Construct dist directory
cp -r build/* dist/
cp package.json package-lock.json dist/
if [[ -e protos ]]; then
    cp -rL protos dist/
fi
if [[ -e META-INF ]]; then
    cp -rL META-INF dist/
fi

# Make simple scripts for CC testing
if [[ -z $CORE_PEER_ADDRESS ]]; then
    CORE_PEER_ADDRESS="peer:7052"
fi
if [[ -z $CORE_CHAINCODE_ID_NAME ]]; then
    CORE_CHAINCODE_ID_NAME="mycc:0"
fi

cat > dist/runcc.sh <<EOF
if [[ -z \$CORE_PEER_ADDRESS ]]; then
    export CORE_PEER_ADDRESS=$CORE_PEER_ADDRESS
fi
if [[ -z \$CORE_CHAINCODE_ID_NAME ]]; then
    export CORE_CHAINCODE_ID_NAME=$CORE_CHAINCODE_ID_NAME
fi
npm run startd
EOF
chmod 0744 dist/runcc.sh

popd >/dev/null

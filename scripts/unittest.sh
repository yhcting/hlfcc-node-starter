#!/bin/bash
set -eo pipefail

wsdir=$(readlink -e "$1")
opt="$2"

if [[ ! -d $wsdir ]]; then
    echo "Invalid workding directory: $1" >&2
    exit 1
fi

pushd "$wsdir" >/dev/null
if [[ "coverage" == "$2" ]]; then
    nyc -r lcov -e .ts -x "*.spec.ts" mocha -r ts-node/register --preserve-symlinks $(find -L src -name \*.spec.ts) && nyc report
else
    mocha -r ts-node/register --preserve-symlinks $(find -L src -name \*.spec.ts)
fi
popd >/dev/null

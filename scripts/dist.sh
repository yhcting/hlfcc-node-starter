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

cp -r build/* dist/
cp package.json package-lock.json dist/
if [[ -e protos ]]; then
    cp -rL protos dist/
fi
if [[ -e META-INF ]]; then
    cp -rL META-INF dist/
fi
popd >/dev/null

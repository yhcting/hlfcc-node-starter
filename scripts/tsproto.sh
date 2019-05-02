#!/bin/bash

set -eo pipefail

basedir="$(dirname $(dirname $(readlink -e $0)))"
bindir="$basedir/node_modules/.bin"

if [[ $# != 2 ]]; then
    echo 'Usage: tsproto.sh OUT-DIR PROTO-FILE' >&2
    exit 1
fi

outdir="$1"
protofile="$2"
if [[ ! -d $outdir
        || ! -f $protofile ]]; then
    echo 'Usage: tsproto.sh OUT-DIR PROTO-FILE [PROTO-FILE ...]' >&2
    exit 1
fi

protocGenTsPath="$bindir/protoc-gen-ts"

if [[ -z $(which protoc) ]]; then
    echo 'Error: protoc is not found!' >&2
    exit 1
fi

if [[ ! -f $protocGenTsPath ]]; then
    echo "Error: ts-protoc-gen is not installed yet at $basedir" >&2
    exit 1
fi

protoc \
    --plugin="protoc-gen-ts=${protocGenTsPath}" \
    --js_out="import_style=commonjs,binary:${outdir}" \
    --ts_out="${outdir}" \
    -I $(dirname $protofile) $protofile

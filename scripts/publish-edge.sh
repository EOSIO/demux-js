#!/usr/bin/env bash

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $dir/functions.sh

setup_git || exit 1
clean_git || exit 1
if ! publish_edge; then
  echo "✖ Publishing of edge release to NPM failed"
  exit 1
fi

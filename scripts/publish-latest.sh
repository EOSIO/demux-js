#!/usr/bin/env bash

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $dir/functions.sh

setup_git || exit 1
clean_git || exit 1
check_head || exit 1
check_version || exit 1
if ! publish_latest; then
  echo "✖ Publishing of new release to NPM failed"
  exit 1
fi

#!/usr/bin/env bash
./node_modules/.bin/tsc
NODE_PATH=./dist/ node examples/$1/index.js

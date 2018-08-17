#!/usr/bin/env bash
cd examples/$1/ && npm install > "/dev/null" 2>&1 && node index.js

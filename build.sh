#!/usr/bin/env bash

cd $(dirname $0) &&
rm -rf dist &&
tsc # build with typescript
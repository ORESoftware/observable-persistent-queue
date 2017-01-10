#!/usr/bin/env bash


# if it wasn't apparent this project uses TypeScript for some static type checking
# furthermore, since RxJS is written with TS, it makes integration a bit easier
# if you don't have tsc at the command line, you will need to install TypeScript

cd $(dirname $0) &&
rm -rf dist &&
tsc # build with typescript
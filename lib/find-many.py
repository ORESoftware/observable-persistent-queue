#!/usr/bin/env python

import re,os,sys
logfile = sys.argv[1]
regex = sys.argv[2]

pattern = re.compile(regex)

with open(logfile,"r+") as f:
    while True:
        old_offset = f.tell()
        l = f.readline()
        if not l:
            break
        if pattern.search(l):
            print(str(l) + '\n')

#!/usr/bin/env python

import re,os,sys,json
logfile = sys.argv[1]
regex = json.loads(sys.argv[2]);
max = int(sys.argv[3])

regexes=[]

for r in regex:
    regexes.append(re.compile(r))

def matchesAll(line):
    for r in regexes:
        if not r.search(line):
            return False
    return True

count = 0

with open(logfile,"r+") as f:
    while (count < max):
        old_offset = f.tell()
        l = f.readline()
        if not l:
            break
        if matchesAll(l):
            count = count + 1
            # match: blank the line
            new_offset = f.tell()
            if old_offset > len(os.linesep):
                old_offset-=len(os.linesep)
            f.seek(old_offset)
            f.write(" "*(new_offset-old_offset-len(os.linesep)))
            print(str(l) + "\n")

#!/usr/bin/env python

import re,os,sys,json
logfile = sys.argv[1]
regex = json.loads(sys.argv[2]);

regexes=[]

for r in regex:
    regexes.append(re.compile(r))

def matchesAll(line):
    for r in regexes:
        if not r.search(line):
            return False
    return True


with open(logfile,"r+") as f:
    while True:
        old_offset = f.tell()
        print("old offset => " + `old_offset`);
        l = f.readline()
        if not l:
            break
        if matchesAll(l):
            # match: blank the line
            new_offset = f.tell()
            print("new offset => " + `new_offset`);
            if old_offset > len(os.linesep):
                old_offset-=len(os.linesep)
            f.seek(old_offset)
            f.write(" "*(new_offset-old_offset-len(os.linesep)))
            print(str(l))
            break;
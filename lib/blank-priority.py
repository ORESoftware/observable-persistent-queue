#!/usr/bin/env python

import re,os,sys,json
logfile = sys.argv[1]
regex = json.loads(sys.argv[2]);
max = int(sys.argv[3])
priority = int(sys.argv[4])
priority_max = int(sys.argv[5])

regexes=[]

for r in regex:
    regexes.append(re.compile(r))

def matchesAll(line):
    for r in regexes:
        if not r.search(line):
            return False
    return True


lines=[];

def findHighest(lines):
    global priority
    priority_temp = None
    ret = None
    for l in lines:
        l = json.loads(str(l).rstrip())
        p = l['priority']
        if p <= priority and p > priority_temp:
            priority_temp=p
            ret=l['uid']
    if not ret:
        priority=priority + 1
        return findHighest(lines)
    return ret;


count = 0

with open(logfile,"r+") as f:
    while (count < priority_max):
        l = f.readline()
        if not l:
            break
        if matchesAll(l):
            count = count + 1
            lines.append(l)
    f.close()


if len(lines) < 1:
     sys.exit();

reg_temp=findHighest(lines)

if not reg_temp:
    sys.exit();

reg=re.compile(reg_temp);

count = 0

with open(logfile,"r+") as f:
    while (count < max):
        old_offset = f.tell()
        l = f.readline()
        if not l:
            break
        if reg.search(l):
            count = count + 1
            # match: blank the line
            new_offset = f.tell()
            if old_offset > len(os.linesep):
                old_offset-=len(os.linesep)
            f.seek(old_offset)
            f.write(" "*(new_offset-old_offset-len(os.linesep)))
            print(str(l) + "\n")

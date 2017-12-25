'use strict';

//core
import cp = require('child_process');

//npm
import colors = require('chalk');
import {ChildProcess} from "child_process";

//project
import {log} from './logging';

///////////////////////////////////////////////////////////////

const unref = function (n: ChildProcess) {
  n.stderr.removeAllListeners();
  n.stdout.removeAllListeners();
  n.removeAllListeners();
  n.unref();
};

export const tail = function (fp: string) {
  
  const n = cp.spawn('tail', ['-F', '-n', '+1', fp]);
  // const n = cp.spawn('watch', ['tail', '-n', '+1', file]);
  
  n.on('error', function (err) {
    log.error(' => spawn error => ', err.stack || err);
    unref(n);
  });
  
  n.stdout.setEncoding('utf8');
  n.stderr.setEncoding('utf8');
  
  n.stderr.on('data', function (d) {
    console.error('tail spawn stderr => ', String(d));
  });
  
  process.once('exit', function () {
    n.kill();
  });
  
  n.on('close', function (code) {
    
    unref(n);
    log.error('tail child process may have closed prematurely => ', code);
  });
  
  return n.stdout;
  
};
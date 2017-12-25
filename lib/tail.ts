'use strict';

//core
import cp = require('child_process');

//npm
import colors = require('chalk');
import {ChildProcess} from "child_process";

///////////////////////////////////////////////////////////////

const unref = function (n: ChildProcess) {
  n.stderr.removeAllListeners();
  n.stdout.removeAllListeners();
  n.removeAllListeners();
  n.unref();
};

export const tail =  function (fp: string) {
  
  const n = cp.spawn('tail', ['-F', '-n', '+1', fp]);
  // const n = cp.spawn('watch', ['tail', '-n', '+1', file]);
  
  n.on('error', function (err) {
    console.error('\n', colors.bgRed(' => spawn error => '), '\n', err.stack || err);
    unref(n);
  });
  
  n.stdout.setEncoding('utf8');
  n.stderr.setEncoding('utf8');
  
  n.stderr.on('data', function (d) {
    console.error('\n', colors.bgRed.white.bold(' => tail spawn stderr => '), '\n', String(d));
  });
  
  process.once('exit', function () {
    n.kill();
  });
  
  n.on('close', function (code) {
    
    unref(n);
    console.error('\n', colors.bgRed(' => tail child process may have closed prematurely => '), code);
  });
  
  return n.stdout;
  
};
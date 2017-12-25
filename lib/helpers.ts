'use strict';

//core
import util = require('util');
import fs = require('fs');
import path = require('path');
import assert = require('assert');
import cp = require('child_process');
import EE = require('events');

//npm
import {Observable} from 'rxjs/Rx';
import _ = require('lodash');
import uuidV4 = require('uuid/v4');
import colors = require('colors/safe');

//project
import {sed} from './sed';
import _countLines = require('./count-lines');
import {Queue} from "./queue";
import {QProto} from "./queue-proto";
const debug = require('debug')('cmd-queue');

import {
  
  IBackpressureObj,
  IGenericObservable,
  IClientCount
  
}
  from "./object-interfaces";

/////////////////////////////////////////////////////////////////////////////////////////////

const start = Date.now();
let drainLocks = 0;
let drainUnlocks = 0;
let releaseLockCount = 0;
let acquireLockCount = 0;
let count = 0;

/////////////////////////////////////////////////////////////////////////////////////////////

// TODO: http://askubuntu.com/questions/509881/tail-reading-an-entire-file-and-then-following

export const makeEEObservable = function (q: Queue, ee: EE, opts: IGenericObservable): Observable<any> {
  
  opts = opts || {};
  const isCallCompleted = opts.isCallCompleted;
  const isPublish = opts.isPublish;
  
  let obs = Observable.create(sub => {
    
    if (q.isReady) {
      // this seemingly superfluous check prevents race conditions in the case that
      // the "executor" function is not called synchronously
      sub.next();
      if (true || isCallCompleted) {
        sub.complete();
      }
    }
    else {
      ee.once('error', function (err) {
        sub.error(err)
      });
      
      ee.once('ready', function () {
        sub.next();
        if (true || isCallCompleted) {
          sub.complete();
        }
      });
    }
    
    return function () {
      // console.log(' => ee observable disposed.');
    }
  });
  
  if (isPublish) {
    obs = obs.publish().refCount();
  }
  return obs;
};

export const makeGenericObservable = function (fn?: Function, opts?: IGenericObservable): Observable<any> {
  
  opts = opts || {};
  const isCallCompleted = opts.isCallCompleted;
  const isPublish = opts.isPublish;
  
  let obs = Observable.create(sub => {
    if (fn) {
      fn(function (err, val) {
        if (err) {
          sub.error(err);
        }
        else {
          sub.next(val);
          if (true || isCallCompleted) {
            sub.complete();
          }
          
        }
      });
    }
    else {
      process.nextTick(function () {
        sub.next();
        if (true || isCallCompleted) {
          sub.complete();
        }
      });
    }
    
  });
  
  if (isPublish) {
    obs = obs.publish().refCount();
  }
  return obs;
};

export const countLines = function (q: Queue, pattern?: string): Observable<any> {
  return _countLines(q.fp, pattern);
};

export const findFirstLine = function (q: Queue, pattern?: string): Observable<any> {
  
  pattern = pattern || '\\S+';
  
  const count = 1;
  return sed(q, pattern, false, count)
  .map(data => {
    return data[0];
  });
};

export const removeOneLine = function (q: Queue, pattern?: string): Observable<any> {
  
  pattern = pattern || '\\S+';
  
  const count = 1;
  
  return sed(q, pattern, true, count)
  .map(data => {
    if (data.length > 1) {
      console.error(colors.red(' => OPQ Implementation Warning => ' +
        'removeOneLine data had a length greater than 1.'));
    }
    return data[0];
  });
};

export const removeMultipleLines = function (q: QProto, pattern?: string, count?: any): Observable<any> {
  
  return sed(q, pattern, true, count)
  .map(data => {
    assert(Array.isArray(data),
      ' => Implementation error => data should be in an array format.');
    return data;
  });
  
};

export const writeFile = function (q: Queue, data?: string): Observable<any> {
  
  const filePath = q.fp;
  data = data || '';
  
  return Observable.create(sub => {
    fs.writeFile(filePath, data, err => {
      if (err) {
        return sub.error(err);
      }
      
      sub.next();
      sub.complete();
    });
    
    return function () {
      // console.log('disposing appendFile()');
    }
  });
  
};

export const appendFile = function (q: QProto, $lines: Array<string> | string, priority: number): Observable<any> {
  
  const filePath = q.fp;
  assert(Number.isInteger(priority), ' => Implementation error => "priority" must be an integer.');
  
  let lines: Array<string> = _.flattenDeep([$lines]);
  
  //ensure new line separation
  lines = lines.map(function (l) {
    
    assert.equal(typeof l, 'string');
    assert(!l.match(/:/), ' => Usage error => You cannot use colon characters in your queue messages, ' +
      'as OPQ uses colons to easily delineate JSON.');
    
    return JSON.stringify({
      line: l,
      dateCreated: new Date().toISOString(),
      pid: process.pid,
      uid: uuidV4(),
      priority: priority,
    });
  });
  
  // const data = '\n' + lines.join('\n') + '\n';
  
  const data = lines.join('\n') + '\n';
  
  return Observable.create(sub => {
    fs.appendFile(filePath, data, {flag: 'a'}, err => {
      if (err) {
        return sub.error(err);
      }
      
      sub.next(lines);
      sub.complete();
      
    });
    
    return function () {
    
    }
  });
  
};

export const delayObservable = function (delay?: number, isCompleted?: boolean): Observable<any> {
  return Observable.create(sub => {
    setTimeout(function () {
      sub.next();
      if (isCompleted) {
        sub.complete();
      }
    }, delay || 100);
  });
};

export const ifFileExistAndIsAllWhiteSpaceThenTruncate = function (q: Queue): Observable<any> {
  
  return readFile(q)
  .flatMap(data => {
    if (data) {
      return makeGenericObservable();
    }
    else {
      // if not data, then we truncate file
      return writeFile(q);
    }
  });
};

export const genericAppendFile = function (q: Queue, data: any): Observable<any> {
  
  const d = data || '';
  const fp = q.filepath;
  
  return Observable.create(sub => {
    // try to open file for reading and writing
    // fs.writeFile(fp, d, {flag: 'w+'}, err => {
    fs.appendFile(fp, d, {}, err => {
      if (err) {
        return sub.error(err);
      }
      
      sub.next();
      sub.complete();
    });
    
    return function () {
      // console.log('disposing genericAppendFile()');
    }
  });
};

export const acquireLockRetry = function (q: QProto, obj: any): Observable<any> {
  
  if (!obj.error) {
    return makeGenericObservable(null, null)
    .map(() => obj);
  }
  
  console.log('\n\n', colors.red.bold(' => need to retry acquiring lock.'), '\n\n');
  
  return Observable.interval(1500)
  .takeUntil(
    // take until either the timeout occurs or we actually acquire the lock
    Observable.race(
      acquireLock(q, obj.name)
      .filter(obj => !obj.error),
      
      Observable.timer(3600)
      .flatMap(() => {
        return Observable.throw('Rx.Observable.throw => acquire lock timed out')
      })
    )
  )
  
};

export const backpressure = function (q: Queue, val: IBackpressureObj, fn: Function): Observable<any> {
  
  return Observable.create(sub => {
    
    fn.call(sub, function (err, ret) {
      if (err) {
        return sub.error(err);
      }
      
      sub.next(ret);
      process.nextTick(function () {
        val.cb();
      });
      
    });
    
    return function () {
    
    }
  });
};

export const readFile$ = function (q: QProto): Observable<any> {
  
  const fp = q.filepath;
  
  return Observable.create(obs => {
    
    fs.readFile(fp, 'utf8', function (err, data) {
      if (err) {
        return obs.error(err);
      }
      
      obs.next(data);
      obs.complete();
      
    });
    
    return function () {
      // console.log('disposing readFile()');
    }
  });
};

export const readFile = function (q: Queue): Observable<any> {
  
  const fp = q.filepath;
  
  return Observable.create(obs => {
    
    const n = cp.spawn('grep', ['-m', '1', '-E', '\\S+', fp]);
    
    let data = '';
    n.stdout.setEncoding('utf8');
    n.stderr.setEncoding('utf8');
    
    n.stdout.on('data', d => {
      data += String(d);
    });
    
    n.stderr.on('data', function (d) {
      console.error(colors.bgRed(' => grep error => '), String(d));
    });
    
    n.once('close', function (code) {
      
      n.stderr.removeAllListeners();
      n.stdout.removeAllListeners();
      n.removeAllListeners();
      
      if (code > 1) {
        obs.error({
          'grep-exit-code': code
        });
      }
      else {
        
        obs.next(data);
        obs.complete();
      }
      
    });
    
    return function () {
    
    }
  });
};

export const waitForClientCount = function (q: QProto, opts: any): Observable<any> {
  
  opts = opts || {};
  const count = opts.count || 10;
  const timeout = opts.timeout || 3000;
  const tries = opts.tries || 5;
  const diff = opts.diff || 5;
  
  let index = 0;
  
  return q.clientStream.bufferCount(count)
  .filter(value => {
    
    index++;
    
    const first = value[0];
    const last = value[value.length - 1];
    
    if (last.clientCount < 10) {
      console.log(' client count is less than 10.');
      return true;
    }
    
    if (index >= tries) {
      // we have tried enough, have to let it through
      console.log('try limit is reached must let through.');
      return true;
    }
    
    // console.log('client diff:',diff);
    
    if ((first.clientCount - last.clientCount) > diff) {
      // client buildup is now reduced, so we can make more requests
      console.log('count is less than diff, we let through.');
      return true;
    }
    
    // console.log('condition not met in wait for client count.');
    return false;
    
  })
  .take(1);
};

export const acquireLock = function (q: QProto, name: string): Observable<any> {
  
  const lock = q.lock;
  const client = q.client;
  
  if (typeof name !== 'string') {
    throw new Error(' => OPQ implementation error => no name for mutex append.');
  }
  
  return Observable.create(sub => {
    
    client.lock(lock, {append: name}, function (err, unlock, id) {
      if (err) {
        console.error('\n\n', ' => Error acquiring lock => \n', (err.stack || err));
      }
      else {
        acquireLockCount++;
        
        if (String(name).startsWith('<drain')) {
          drainLocks++;
          debug('\n\n', 'drain locks/unlocks (locking) => ', drainLocks, drainUnlocks, '\n\n');
        }
      }
      
      debug(util.inspect({
        acquireLockCount: acquireLockCount,
        releaseLockCount: releaseLockCount
      }));
      
      sub.next({
        error: err ? (err.stack || err) : undefined,
        id: id,
        name: name
      });
      
      sub.complete();
      
    });
    
    return function () {
      // console.log('disposing acquireLock()');
    }
  });
};

export const releaseLock = function (q: QProto, lockUuid: string | boolean): Observable<any> {
  
  const client = q.client;
  
  if (!lockUuid) {
    console.error('\n\n', new Error('Cannot release lock without force or proper uuid.').stack, '\n\n');
    return Observable.throw('Cannot release lock without force or proper uuid.\n\n');
  }
  
  if (String(lockUuid).startsWith('<drain')) {
    drainUnlocks++;
    debug('\n\n', 'drain locks/unlocks => ', drainLocks, drainUnlocks, '\n\n');
  }
  
  return Observable.create(sub => {
    
    const lock = q.lock;
    
    client.unlock(lock, lockUuid, function (err) {
      
      if (err) {
        console.error('\n', ' => Release lock error => ', '\n', err.stack || err);
      }
      else {
        releaseLockCount++;
      }
      
      sub.next({
        error: err ? (err.stack || err) : undefined
      });
      
      sub.complete();
      
    });
    
    return function () {
      // console.log('disposing releaseLock()');
    }
  });
  
};

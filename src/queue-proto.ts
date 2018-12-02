'use strict';

//core
import util = require('util');
import fs = require('fs');
import path = require('path');
import assert = require('assert');

//npm
import {Observable, Subject} from 'rxjs/Rx';
import _ = require('lodash');
import uuidV4 = require('uuid/v4');
import colors = require('chalk');

//project
import EE = require('events');
import {Client,lmUtils} from 'live-mutex';
import {log} from './logging';

import {
  IPriority,
  IPriorityInternal,
  IDequeueOpts,
  IQueueBuilder,
  IEnqueueOpts
}
  from "./object-interfaces";

import {
  
  acquireLock,
  releaseLock,
  removeMultipleLines,
  appendFile,
  acquireLockRetry,
  waitForClientCount
  
} from './helpers';

export abstract class QProto {
  
  isReady: boolean;
  lock: string;
  client: Client;
  port: number;
  init: Function;
  dateCreated: Date;
  fp?: string;
  filePath?: string;
  filepath?: string;
  isEmptyStream: Subject<any>;
  obsEnqueue: Subject<any>;
  obsDequeue: Subject<any>;
  obsClient: Subject<any>;
  clientStream: Observable<any>;
  queueStream: Observable<any>;
  priority: IPriority;
  _priority: IPriorityInternal;
  
  constructor(obj: IQueueBuilder) {
    
    this.lock = ['[OPQ]>', uuidV4()].join('');
    this.dateCreated = new Date();
    this.filePath = obj.filePath;
    
  }
  
  getLock(): string {
    return this.lock;
  }
  
  getClient(): Client {
    return this.client;
  }
  
  close(): void {
    this.client && this.client.close();
  }
  
  _enqControlled(lines: string | string[], opts: IEnqueueOpts) {
    
    opts = opts || {};
    
    const priority = opts.priority || 1;
    const isShare = opts.isShare !== false;
    
    lines = _.flattenDeep([lines]);
    
    let add$ = this.init()
    .flatMap(() => {
      return waitForClientCount(this, {timeout: 3000, count: 25, tries: 25})
    })
    .flatMap(() => {
      return acquireLock(this, '<enqControlled>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      })
      .map(obj => ({error: obj.error, id: obj.id, opts: opts}))
      .flatMap(obj => {
        return appendFile(this, lines, priority)
        .map(() => obj)
        .flatMap(obj => releaseLock(this, obj.id))
      });
    })
    .catch(err => {
      console.error('add/enqueue error:', err.stack || err);
      const force = !String(err.stack || err).match(/acquire lock timed out/);
      return releaseLock(this, force);
    })
    .take(1);
    
    if (isShare) {
      add$ = add$.share();
      add$.subscribe();
    }
    
    return add$;
  }
  
  _deqWait(opts: IDequeueOpts): Subject<any> {
    
    const count = opts.count;
    const isConnect = opts.isConnect !== false;
    const pattern = opts.pattern;
    const min = opts.min || count;
    
    assert(Array.isArray(opts.lines), 'OPQ Implementation error => opts.lines should be an array');
    
    // store the lines here which we will eventually send back
    let ret = <any> [];
    
    const obs: any = new Subject<any>();
    
    process.nextTick(function () {
      // this will kick-off the below observable chain
      obs.next();
    });
    
    let $dequeue = obs
    .flatMap(() => {
      return this.init();
    })
    .flatMap(() => {
      return acquireLock(this, '<deqWait>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      });
    })
    .flatMap(obj => {
      return removeMultipleLines(this, pattern, count - ret.length)
      .map(lines => ({obj: obj, lines: lines}))
    })
    .flatMap((data: any) => {
      
      const obj = data.obj;
      const lines = data.lines;
      ret = ret.concat(lines).filter(i => i);
      const len = ret.length;
      const diff = min - len;
      
      if (diff < 1) {
        $dequeue.complete();
        obs.unsubscribe();
        return releaseLock(this, obj.id)
        .map(() => ({lines: ret}))
      }
      else {
        return releaseLock(this, obj.id)
        .flatMap(() => {
          return Observable.race(
            Observable.timer(8500),
            // we only want to re-invoke this chain after more items have been added to the queue
            // otherwise there would be no point
            // however, after 8+ seconds, we might as well retry just in case?
            this.obsEnqueue.skip(diff).take(1)
          )
        })
        .filter(() => {
          obs.next();
          // explicit for your pleasure
          // since we did not get enough results, we must wait and retry for more
          // we retry by fire obs.next() above, which re-calls this whole chain
          // this avoids more traditional recursion for much safer and simpler stuff
          return false;
        });
      }
    })
    .catch(e => {
      console.error(e.stack || e);
      const force = !String(e.stack || e).match(/acquire lock timed out/);
      return releaseLock(this, force);
    })
    // only take one, then we are done and should fire onComplete()
    .take(1);
    
    if (isConnect) {
      // this is necessary, if the user does not call subscribe,
      // if the user does not want to auto-subscribe, they will have to pass in isConnect=false.
      $dequeue = $dequeue.publish();
      $dequeue.connect();
    }
    
    return $dequeue;
    
  }
}


'use strict';

//core
import util = require('util');
import fs = require('fs');
import path = require('path');
import assert = require('assert');

//npm
import {Subject, Observable, Subscriber} from 'rxjs/Rx';
import _ = require('lodash');
import uuidV4 = require('uuid/v4');
import colors = require('colors/safe');

//project
const debug = require('debug')('cmd-queue');
import EE = require('events');
import {Client} from 'live-mutex/client';
import lmUtils = require('live-mutex/utils');
import {QProto} from './queue-proto';
import handlePriority = require('./handle-priority');
import {startTail} from './start-tail';
import {IPriority, IPriorityInternal, IQueueBuilder, IDequeueOpts, IDrainOpts, IEnqueueOpts} from "./object-interfaces";

////////////////////////////// add some of our own operators ///////////////////////////////////

require('./rxjs-patches');

////////////////////////////////////////////////////////////////////////////////////////////////////

process.on('warning', function (w) {
  if (!String(w).match(/DEBUG_FD/)) {
    console.error('\n', ' => OPQ warning => ', w.stack || w, '\n');
  }
});

// READING =>
// http://reactivex.io/documentation/operators/backpressure.html
// https://gist.github.com/staltz/868e7e9bc2a7b8c1f754
// https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/backpressure.md
// http://stackoverflow.com/questions/41077300/rxjs-pause-upon-resume-give-last-paused-value
// https://stackoverflow.com/questions/41337517/publishing-observable-to-make-it-hot

/////////////////////////////////////////////////////////////////////////////////////////////////////

// helper functions
const {

  backpressure,
  countLines,
  acquireLock,
  releaseLock,
  genericAppendFile,
  makeEEObservable,
  removeOneLine,
  removeMultipleLines,
  appendFile,
  acquireLockRetry,
  makeGenericObservable,
  ifFileExistAndIsAllWhiteSpaceThenTruncate,
  findFirstLine

} = require('./helpers');

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Queue extends QProto {

  init: Function;
  priority: IPriority;
  _priority: IPriorityInternal;

  constructor(obj: IQueueBuilder) {

    super(obj);

    assert(typeof obj === 'object',
      ' => OPQ usage error => Please pass in an options object to the Queue constructor.');
    const fp = this.fp = this.filepath = obj.filepath || obj.filePath || obj.fp;
    const port = this.port = obj.port;

    assert(String(fp).length > 0, ' => Please pass the filepath of the queue.');
    assert(Number.isInteger(port), ' => Please pass in an integer for the port.');

    const lck = this.lock;

    if (obj.priority) {
      handlePriority(obj, this);
    }

    this.isEmptyStream = new Subject<any>();
    this.obsDequeue = new Subject<any>();
    let index = 0;

    let obsEnqueue = this.obsEnqueue = new Subject<any>();

    this.queueStream = Observable.create(obs => {

      const push = Subscriber.create(v => {
        if ((index % obsEnqueue.observers.length) === obsEnqueue.observers.indexOf(push)) {
          obs.next(v);
        }
      });

      return obsEnqueue.subscribe(push);
    });

    const push = v => {
      obsEnqueue.next(v);
      index++;
    };

    process.once('exit', () => {
      this.close();
    });

    this.isReady = false;
    let callable = true;

    let obsClient = this.obsClient = new Subject<any>();
    const clientEE = new EE().setMaxListeners(200);

    let opqId = 0;

    this.clientStream = Observable.create(sub => {

      const push = Subscriber.create(v => {

        if (push === obsClient.observers[0]) {
          sub.next(v);
        }
      });

      push.opqId = opqId++;

      return obsClient.subscribe(push);
    });

    function onClientConnectionChange(clientCount) {
      // console.log(' => client count => ', clientCount);
      obsClient.next({
        time: Date.now(),
        clientCount
      });
    }

    // init both creates the queue file if it does not exist, and finds/initializes the live-mutex
    this.init = (isPublish) => {

      if (this.isReady) {
        return makeGenericObservable(null, {isPublish: isPublish});
      }

      if (!callable) {
        //if init() has already been called but this queue instance is not ready yet
        return makeEEObservable(this, clientEE, {isPublish: isPublish});
      }

      callable = false;

      const promise = lmUtils.launchBrokerInChildProcess({port, detached: true});

      return Observable.fromPromise(promise)
      .flatMap(() => {
        this.client = new Client({key: lck, port: port, listener: onClientConnectionChange});
        console.log('clienting...');
        return Observable.fromPromise(this.client.ensure());
      })
      .flatMap(() => {
        console.log('acquiring lock...');
        return acquireLock(this, '<init>')
        .flatMap(obj => {
          console.log('acquiring lock...retry');
          return acquireLockRetry(this, obj)
        });
      })
      .flatMap(obj => {
        console.log('genericAppendFile');
        return genericAppendFile(this, '')
        .map(() => obj)
      })
      .flatMap(obj => {
        return ifFileExistAndIsAllWhiteSpaceThenTruncate(this)
        .map(() => obj)
      })
      .flatMap((obj: any) => {
        return releaseLock(this, obj.id);

      }).do(() => {
        clientEE.emit('ready');
        this.isReady = true;
        startTail(this, push);
      })
      .take(1)
      .catch(e => {
        console.error(e.stack || e);
        const force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(this, force);

      });
    };
  }

  eqStream(pauser?: Subject<any>, opts?: any): Observable<any> {

    if (!(pauser instanceof Observable)) {
      opts = pauser || {};
      pauser = new Subject<any>();
    }

    opts = opts || {};

    let $obs: Observable<any> = Observable.zip(
      this.queueStream,
      pauser
    );

    process.nextTick(function () {
      pauser.next();
    });

    return $obs
    .flatMap(() => this.init())
    .flatMap(() => {
      return acquireLock(this, 'eqStream')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      });
    })
    .flatMap((obj: any) => {
      return removeOneLine(this, null)
      .map(l => ({l: l, id: obj.id}));
    })
    .flatMap((obj: any) => {
      return releaseLock(this, obj.id)
      .filter(() => !!obj.l)
      .map(() => {
        return {
          data: obj.l,
          cb: pauser.next.bind(pauser)
        };
      });
    })
    .catch(e => {
      console.error('\n', ' => Error in dequeueStream method => ', '\n', e.stack || e, '\n');
      const force = !String(e.stack || e).match(/acquire lock timed out/);
      return releaseLock(this, force);
    });

  }

  readAll(): Subject<any> {
    return this.obsEnqueue;
  }

  isNotEmpty(obs?: Subject<any>): Observable<any> {

    if (!obs) {
      obs = new Subject();
    }

    return obs
    .startWith(0)
    .flatMap(() => {
      // when you call obs.next(), it should fire this chain again
      return this.init();
    })
    .flatMap(() => {
      return acquireLock(this, '<isEmpty>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      })
    })
    .flatMap((obj: any) => {
      return findFirstLine(this)
      .flatMap(l => {
        return releaseLock(this, obj.id)
        .map(() => {
          return l;
        });
      });
    })
    .filter(l => {
      // filter out any lines => only fire event if there is no line
      return !!l;
    })
    .map(() => {
      console.log(colors.yellow(' => Queue is *not* empty.'));
      return {isEmpty: false}
    })
    .catch(e => {
      console.error('\n', ' => isEmpty() error => \n', e.stack || e);
      const force = !String(e.stack || e).match(/acquire lock timed out/);
      return releaseLock(this, force);
    })
    .take(1);

  }

  isEmpty(obs: Subject<any>): Observable<any> {

    if (!obs) {
      obs = new Subject<any>();

      process.nextTick(function () {
        obs.next();
      });
    }

    return obs
    .startWith(0)
    .flatMap(() => {
      return this.init(); // // when you call obs.next(), it should fire this chain again
    })
    .flatMap(() => {
      return acquireLock(this, '<isEmpty>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      })
    })
    .flatMap((obj: any) => {
      return findFirstLine(this, null)
      .flatMap(l => {
        return releaseLock(this, obj.id)
        .map(() => {
          return l;
        });
      })
    })
    .filter(l => {
      // filter out any lines => only fire event if there is no line
      return !l;
    })
    .map(() => {
      console.log(colors.yellow(' => Is empty is true.'));
      // obs.complete();
      return {isEmpty: true}
    })
    .catch(e => {
      console.error('\n', ' => isEmpty() error => \n', e.stack || e);
      const force = !String(e.stack || e).match(/acquire lock timed out/);
      return releaseLock(this, force);
    })
    .take(1);

  }

  drain(obs?: Subject<any>, opts?: IDrainOpts): Observable<any> {

    if (!(obs instanceof Subject)) {
      opts = obs || {};
      obs = new Subject<any>();
    }

    opts = opts || {};
    assert(typeof opts === 'object' && !Array.isArray(opts), ' => OPQ usage error => opts must be an object.');

    //TODO: if force, we drain the queue even if there are no subscribers to this observable
    //TODO: otherwise if there are no subscribers, the callback will never fire
    const force = opts.force;
    const backpressure = opts.backpressure === true;
    const isConnect = opts.isConnect === true;
    const delay = opts.delay || 500;

    process.nextTick(function () {
      obs.next();
    });

    const emptyObs = new Subject();

    let $obs = obs
    .takeUntil(this.isEmpty(emptyObs))
    .flatMap(() => {
      return this.init();
    })
    .flatMap(() => {
      return acquireLock(this, '<drain>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      });
    })
    .flatMap((obj: any) => {
      return removeOneLine(this)
      .flatMap(l => {
        return releaseLock(this, obj.id)
        .map(() => {
          emptyObs.next();
          const bound = obs.next.bind(obs);
          if (backpressure) {
            return {data: l, cb: bound};
          }
          else {
            process.nextTick(bound);
            return {data: l};
          }
        });
      });
    })
    .catch(e => {
      console.error('\n', ' => isEmpty() error => \n', e.stack || e);
      const force = !String(e.stack || e).match(/acquire lock timed out/);
      return releaseLock(this, force);
    });

    if (isConnect) {
      $obs = $obs.publish();
      $obs.connect();
    }

    return $obs;

  }

  isPriorityQueue(): boolean {
    return this.priority && this._priority && true;
  }

  backpressure(val: any, fn: Function): Observable<any> {
    return backpressure(this, val, fn);
  }

  clearQueue() {
    // should just truncate file
  }

  getSize(): Observable<any> {
    return countLines(this);
  }

  enqueue(lines: string | Array<string>, opts: IEnqueueOpts): Observable<any> {
    return this.enq(lines, opts);
  }

  enq(lines: string | Array<string>, opts: IEnqueueOpts): Observable<any> {

    opts = opts || {};

    if (opts.controlled) {
      return this._enqControlled(lines, opts);
    }

    const priority = opts.priority || 1;

    if (opts.priority) {
      assert(typeof this._priority === 'object', ' => You used the priority option to enqueue an item,' +
        ' but this queue was not initialized as a priority queue.');

      let il = this._priority.internalLevels;
      const highestLevel = il[il.length - 1];
      assert(Number.isInteger(priority) && priority >= 1 && priority <= highestLevel,
        ' => Given the initial settings of this queue, ' + //
        'priority option must be an integer, between 1 and ' + highestLevel + ', inclusive.')
    }

    const isShare = opts.isShare === true;

    lines = _.flattenDeep([lines]).map(function (l) {
      // remove unicode characters because they will mess up
      // our replace-line algorithm
      return String(l).replace(/[^\x00-\x7F]/g, '');
    });

    let $add = this.init()
    .flatMap(() => {
      return acquireLock(this, '<enqueue>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      });
    })
    .flatMap(obj => {
      return appendFile(this, lines, priority)
      .map(() => obj);
    })
    .flatMap(obj => releaseLock(this, obj.id))
    .catch(err => {
      console.error('\n', ' => add / enqueue error => \n', err.stack || err);
      const force = !String(err.stack || err).match(/acquire lock timed out/);
      return releaseLock(this, force);

    })
    // only take one, then we are done and should fire onComplete()
    .take(1);

    if (isShare) {
      // share() should be equivalent to publish().refCount()
      $add = $add.share();
      $add.subscribe();
    }

    return $add;

  };

  dequeue(opts: any): Observable<any> {
    return this.deq(opts);

  }

  deq(opts: IDequeueOpts): Observable<any> {

    if (!opts || !opts.lines) {

      opts = Object.assign({
        youngerThan: null,
        olderThan: null,
        min: 0,
        count: 1,
        wait: false,
        pattern: '\\S+'

      }, opts);

      opts.lines = [];
    }

    if (opts.wait) {
      return this._deqWait(opts);
    }

    const isPriority = this.priority ?
      (opts.isPriority !== false) :
      (opts.isPriority === true);

    const count = opts.count;
    const isConnect = opts.isConnect !== false;
    const pattern = opts.pattern;
    const min = opts.min;

    let $dequeue = this.init()
    .flatMap(() => {
      return acquireLock(this, '<dequeue>')
      .flatMap(obj => {
        return acquireLockRetry(this, obj)
      })
      .map(obj =>
        ({error: obj.error, id: obj.id, opts: opts}))

    })
    .flatMap(obj => {
      return removeMultipleLines(this, pattern, count)
      .map(lines => ({lines: lines, id: obj.id}))
    })
    .flatMap(obj => {
      return releaseLock(this, obj.id)
      .map(() => obj.lines)
    })
    .catch(e => {
      console.error(e.stack || e);//
      const force = !String(e.stack || e).match(/acquire lock timed out/);
      return releaseLock(this, force);
    })
    // only take one, then we are done and should fire onComplete()
    .take(1);

    if (isConnect) {
      $dequeue = $dequeue.publish();
      $dequeue.connect();
    }

    return $dequeue;

  }
}


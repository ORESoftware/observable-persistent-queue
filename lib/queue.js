'use strict';

//core
const util = require('util');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

//npm
const Rx = require('rxjs');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

//project
const debug = require('debug')('cmd-queue');
const EE = require('events');
const Client = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');
const qProto = require('./queue-proto');
const handlePriority = require('./handle-priority');
const startTail = require('./start-tail');

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

//we could use console.time, but this is fine
const start = Date.now();


const {

    acquireLock,
    releaseLock,
    genericAppendFile,
    readFile,
    makeEEObservable,
    writeFile,
    delayObservable,
    removeOneLine,
    removeMultipleLines,
    appendFile,
    acquireLockRetry,
    makeGenericObservable,
    ifFileExistAndIsAllWhiteSpaceThenTruncate,
    waitForClientCount,
    findFirstLine

} = require('./helpers');

///////////////////////////////////////////////////////////////////////////////////////////////////////////////


function Queue(obj) {

    assert(typeof obj === 'object',
        ' => OPQ usage error => Please pass in an options object to the Queue constructor.');
    const fp = this.filepath = obj.filepath || obj.filePath;
    const port = this.port = obj.port;

    assert(String(fp).length > 0, ' => Please pass the filepath of the queue.');
    assert(Number.isInteger(port), ' => Please pass in an integer for the port.');

    const lck = this.lock = ['[OPQ]>', uuidV4()].join('');

    this.dateCreated = new Date();

    if (obj.priority) {
        handlePriority(obj, this);
    }

    // this.obsEnqueue = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();
    let index = 0;

    let obsEnqueue = this.obsEnqueue = new Rx.Subject();

    this.queueStream = Rx.Observable.create(obs => {

        const push = Rx.Subscriber.create(v => {
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
    this.lockUuid = null;
    var callable = true;

    let obsClient = this.obsClient = new Rx.Subject();
    const clientEE = new EE();

    clientEE.setMaxListeners(200);

    function onClientConnectionChange(clientCount) {
        // console.log('client count => ', clientCount);
        obsClient.next({
            time: Date.now(),
            clientCount: clientCount
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

        const promise = lmUtils.conditionallyLaunchSocketServer({port: port});

        return Rx.Observable.fromPromise(promise)
            .flatMap(() => {
                this.client = new Client({key: lck, port: port, listener: onClientConnectionChange});
                return acquireLock(this, 'init')
                    .flatMap(obj => {
                        return acquireLockRetry(this, obj)
                    });
            })
            .flatMap(obj => {
                return ifFileExistAndIsAllWhiteSpaceThenTruncate(this)
                    .map(() => obj)
            })
            .flatMap(obj => {
                return genericAppendFile(this, '')
                    .map(() => obj)
            })
            .flatMap(obj => {
                return releaseLock(this, obj.id);

            }).map(() => {
                // currently just returns undefined
                return startTail(this, push, clientEE);
            })
            .take(1)
            .catch(e => {
                console.error(e.stack || e);
                const force = !String(e.stack || e).match(/acquire lock timed out/);
                return releaseLock(this, force);

            });
    };
}


Queue.prototype = Object.create(qProto);


Queue.prototype.eqStream = function (pauser, opts) {

    if (!(pauser instanceof Rx.Observable)) {
        opts = pauser || {};
        pauser = new Rx.Subject();
    }

    opts = opts || {};

    let $obs = Rx.Observable.zip(
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
        .flatMap(obj => {
            return removeOneLine(this)
                .map(l => ({l: l, id: obj.id}));
        })
        .flatMap(obj => {
            return releaseLock(this, obj.id)
                .filter(() => obj.l)
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


};

Queue.prototype.readAll = function () {
    return this.obsEnqueue;
};

Queue.prototype.isEmpty = function (obs) {

    if (!obs) {
        obs = new Rx.Subject();

        process.nextTick(function () {
            obs.next();
        });
    }

    return obs
        .flatMap(() => {
            console.log('re-initting...');
            return this.init(); // // when you call obs.next(), it should fire this chain again
        })
        .flatMap(() => {
            console.log('re-acquiring lock...');
            return acquireLock(this, '<isEmpty>')
                .flatMap(obj => {
                    console.log('re-acquireLockRetry lock...');
                    return acquireLockRetry(this, obj)
                })
        })
        .flatMap(obj => {
            console.log('finding first line...');
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
            return !l;
        })
        .map(() => {
            console.log(colors.yellow(' => Is empty is true.'));
            obs.isHellaComplete = true;
            // obs.complete();
            return {isEmpty: true}
        })
        .catch(e => {
            console.error('\n', ' => isEmpty() error => \n', e.stack || e);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        })
        .take(1);

};



Queue.prototype.drain = function (obs, opts) {

    if (!(obs instanceof Rx.Observable)) {
        opts = obs || {};
        obs = new Rx.Subject();
    }

    opts = opts || {};
    assert(typeof opts === 'object' && !Array.isArray(opts), ' => OPQ usage error => opts must be an object.');
    const isConnect = opts.isConnect !== false;
    const delay = opts.delay || 500;

    //TODO: if force, we drain the queue even if there are no subscribers to this observable
    //TODO: otherwise if there are no subscribers, the callback will never fire
    const force = opts.force;

    process.nextTick(function () {
        obs.next();
    });

    let $obs = obs
        .skipWhile(() => {
            return obs.isHellaComplete === true;
        })
        .flatMap(() => {
            return this.init();
        })
        .flatMap(() => {

            // console.log(' inspect $obs => ', util.inspect($obs));
            if ($obs.cheetah) {
                console.log('\n\n CHEETAH =>', colors.bgGreen($obs.cheetah), '\n\n');
            }

            return acquireLock(this, '<drain>')
                .flatMap(obj => {
                    return acquireLockRetry(this, obj)
                });
        })
        .flatMap(obj => {
            return removeOneLine(this)
                .flatMap(l => {
                    return releaseLock(this, obj.id)
                        .map(() => ({data: l, cb: obs.next.bind(obs)}));
                });
        })
        .catch(e => {
            console.error('\n', ' => isEmpty() error => \n', e.stack || e);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        })
        // .last(function(){
        //     return releaseLock(this, true);
        // })
        // keep removing a line until the queue is empty
        // .do(function(){
        //     return releaseLock(this, true);
        // })
        .takeUntil(this.isEmpty(obs))

    // .last(v => {
    //     console.log(' LAST v => ',v);
    //     return releaseLock(this, true);
    // });


    if (isConnect) {
        $obs = $obs.publish();
        $obs.connect();
    }

    return $obs;

};


Queue.prototype.enq = Queue.prototype.enqueue = function (lines, opts) {

    opts = opts || {};

    if (opts.controlled) {
        return this._enqControlled(lines, opts);
    }

    const priority = opts.priority || 1;
    const isShare = opts.isShare !== false;

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


Queue.prototype.deq = Queue.prototype.dequeue = function (opts) {

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
            console.error(e.stack || e);
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

};


module.exports = Queue;
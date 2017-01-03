'use striiiict';

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
const tail = require('./tail');


// READING =>
// http://reactivex.io/documentation/operators/backpressure.html
// https://gist.github.com/staltz/868e7e9bc2a7b8c1f754
// https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/backpressure.md
// http://stackoverflow.com/questions/41077300/rxjs-pause-upon-resume-give-last-paused-value
// https://stackoverflow.com/questions/41337517/publishing-observable-to-make-it-hot


// https://medium.com/@puppybits/rxjs-is-great-so-why-have-i-moved-on-534c513e7af3#.17ijmddvb
// https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35
//TODO: https://www.learnrxjs.io/
//TODO: https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35#publish
//TODO: how to implement backpressure
//TODO: how to "cancel" an observable (maybe using filter?)
//TODO: there are Observables called empty/never, I am looking for one that is like "passthrough" stream
//TODO: if I get more than one line (perhaps via tail), then I want to take one observable and map it to
// many observables, how can that be done?
//https://xgrommx.github.io/rx-book/content/observable/observable_instance_methods/filter.html

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

const start = Date.now();

///////////////////////////

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

    const fp = this.filepath = obj.filepath || obj.filePath || obj.fp;
    const port = this.port = obj.port;

    assert(String(fp).length > 0, ' => Please pass the filepath of the queue.');
    assert(Number.isInteger(port), ' => Please pass in an integer for the port.');

    const lck = this.lock = ['[OPQ]', uuidV4()].join('');

    console.log(' => lock id is => ', lck);
    this.dateCreated = new Date();

    this.priority = obj.priority;

    if (this.priority) {

        assert(typeof this.priority === 'object' && !Array.isArray(this.priority),
            ' => Usage error => "priority option should be an object.');

        this._priority = {};

        const first = this.priority.first; // how many items to look at
        assert(Number.isInteger(first), ' => priority.first must be an integer, greater than 5 and less than 300');
        assert(first > 5 && first < 300, ' => priority.first must be an integer, greater than 5 and less than 300');
        assert.equal(Array.isArray(this.priority.levels), true, ' => priority.levels should be an array.');
        assert(this.priority.levels.length > 1, ' => You must define at least two priority levels.');

        var il = this._priority.internalLevels = [];

        this._priority.levels = this.priority.levels.sort(function (a, b) {
            return b.level > a.level;
        });

        this._priority.first = first;
        this._priority.totalPriorityCycles = this.priority.levels.map(function (obj) {

            assert(Number.isInteger(obj.level), ' => OPQ usage error => "level" must be an integer => ' + util.inspect(obj));
            assert(obj.level > 0 && obj.level < 21, ' => OPQ usage error => Priority level must be an integer which ranges from 1-20');
            assert(Number.isInteger(obj.cycles), ' => OPQ usage error => "cycles" must be an integer => ' + util.inspect(obj));
            assert(obj.cycles > 0 && obj.cycles < 41, ' => OPQ usage error => "cycles" must be an integer which ranges from 1-40');

            il.push(obj.level);
            return obj.cycles;

        }).reduce(function (a, b) {
            return a + b;
        });

        il = il.sort();

        console.log(' => Lowest priority item => ', il[0]);
        console.log(' => Highest priority => ', il[il.length - 1]);

        this._priority.priorityCycleIndex = 0 + this._priority.totalPriorityCycles;
        console.log(' => Total number of cycles => ', this._priority.priorityCycleIndex);
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

    this.push = (v) => {
        obsEnqueue.next(v);
        index++;
    };
    // this.read = () => queueStream;


    this.close = function () {
        this.client && this.client.close();
    };

    process.once('exit', () => {
        this.close();
    });

    this.isReady = false;
    this.lockUuid = null;
    var callable = true;

    let obsClient = this.obsClient = new Rx.Subject();
    const clientEE = this.clientEE = new EE();

    clientEE.setMaxListeners(200);

    function onClientConnectionChange(clientCount) {
        // console.log('client count => ', clientCount);
        obsClient.next({
            time: Date.now(),
            clientCount: clientCount
        });
    }

    // init both creates the queue file if it does not exist, and finds/initializes the live-mutex
    this.init = function (isPublish) {

        if (this.isReady) {
            return makeGenericObservable(null, {isPublish: isPublish});
        }

        if (!callable) {
            return makeEEObservable(clientEE, {isPublish: isPublish});
        }

        callable = false;

        const promise = lmUtils.conditionallyLaunchSocketServer({port: port});

        return Rx.Observable.fromPromise(promise)
            .flatMap(() => {
                this.client = new Client({key: lck, port: port, listener: onClientConnectionChange});
                return acquireLock(this)
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
                return releaseLock(this, obj.id)

            }).map(() => {

                clientEE.emit('ready');

                this.isReady = true;

                //start tailing, only after we know that the file exists, etc.
                tail(fp).on('data', data => {

                    debug('\n', colors.cyan(' => raw data (well, trimmed) from tail => '), '\n', String(data).trim());

                    data = String(data).split('\n')
                        .filter(ln => String(ln).trim().length > 0)
                        .map(ln => String(ln).trim());

                    data.map(function (d) {

                        try {
                            return JSON.parse(d);
                        }
                        catch (err) {
                            console.log('\n', colors.red(' => bad data from tail => '), '\n', d);
                            return '';
                        }

                    }).filter(function (d) {
                        return String(d).trim().length > 0;
                    }).forEach(d => {
                        this.push(d);
                        // this.obsEnqueue.next(d);
                    });

                });
            })
            .catch(e => {
                console.error(e.stack || e);
                const force = !String(e.stack || e).match(/acquire lock timed out/);
                return releaseLock(this, force);

            });
    };
}


Queue.prototype.dequeueStream = Queue.prototype.removeStream = function (pauser) {

    // var obs = this.obsEnqueue;

    var obs = this.queueStream;

    if (pauser) {
        obs = obs.pausableBuffered(pauser);
    }

    return obs
        .flatMap(() => {
            console.log('acquiring lock.');
            return acquireLock(this)
                .flatMap(obj => {
                    console.log('acquiring lock retry.');
                    return acquireLockRetry(this, obj)
                });
        })
        .flatMap(obj => {
            console.log('removing one line.');
            return removeOneLine(this)
                .map(l => ({l: l, id: obj.id}));
        })
        .flatMap(obj => {
            return releaseLock(this, obj.id)
                .filter(() => obj.l)
                .map(() => {
                    const l = obj.l;
                    if (l) {
                        debug('\n', colors.blue(' => line removed via dequeueStream => '),
                            '\n', colors.cyan(util.inspect(l)), '\n');
                    }
                    return l;
                })
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


Queue.prototype.drain = function (obs, opts) {

    opts = opts || {};

    //TODO: instead of recursion we can just do something like dequeueStream
    const delay = opts.delay || 500;

    return obs.takeUntil(this.isEmpty())
        .flatMap(() => {
            console.log('iniiittting');
            return this.init()
        })
        .flatMap(() => {
            return acquireLock(this)
                .flatMap(obj => {
                    console.log(' drain lock id => ', obj.id);
                    return acquireLockRetry(this, obj)
                });
        })
        .flatMap(obj => {
            return removeOneLine(this)
                .flatMap(l => {
                    return releaseLock(this, obj.id)
                        .map(() => l);
                });
        })
        .catch(e => {
            console.error('\n', ' => isEmpty() error => \n', e.stack || e);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });

};

//
// Queue.prototype.drain = function (obs, opts) {
//
//     opts = opts || {};
//
//     //TODO: instead of recursion we can just do something like dequeueStream
//     const delay = opts.delay || 500;
//
//     return this.init()
//         .flatMap(() => {
//             return acquireLock(this)
//                 .flatMap(obj => {
//                     console.log(' drain lock id => ', obj.id);
//                     return acquireLockRetry(this, obj)
//                 });
//         })
//         .flatMap(obj => {
//             return removeOneLine(this)
//                 .flatMap(l => {
//                     return releaseLock(this, obj.id)
//                         .map(obj => {
//                             obs.next(l);
//                             return l;
//                         });
//                 });
//         })
//         .flatMap(() => {
//             return Rx.Observable.timer(500)
//                 .flatMap(() => {
//                     return this.drain(obs, opts)
//                         .takeUntil(this.isEmpty());
//                 });
//         })
//         .catch(e => {
//             console.error('\n', ' => isEmpty() error => \n', e.stack || e);
//             const force = !String(e.stack || e).match(/acquire lock timed out/);
//             return releaseLock(this, force);
//         });
//
// };


Queue.prototype.isEmpty = function () {

    return this.init()
        .flatMap(() => {
            return acquireLock(this)
                .flatMap(obj => {
                    console.log(' isEmpty lock id => ', obj.id);
                    return acquireLockRetry(this, obj)
                })
        })
        .flatMap(obj => {
            return findFirstLine(this)
                .flatMap(l => {
                    return releaseLock(this, obj.id)
                        .map(obj => {
                            if (obj.error) {
                                console.log('error => ', obj);
                            }
                            return l;
                        });
                });
        })
        .filter(l => {
            // filter out any lines => only fire event if there is no line
            return !l;
        })
        .catch(e => {
            console.error('\n', ' => isEmpty() error => \n', err.stack || err);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });

};


Queue.prototype._enqControlled = function (lines, opts) {

    opts = opts || {};

    const priority = opts.priority || 1;

    console.log(' \n We are being controlled. \n ');
    const isShare = opts.isShare !== false;

    lines = _.flattenDeep([lines]);

    let $add = this.init()
        .flatMap(() => {
            return waitForClientCount(this, {timeout: 3000, count: 5})
        })
        .flatMap(() => {
            return acquireLock(this)
                .flatMap(obj => {
                    return acquireLockRetry(this, obj)
                })
                .map(obj =>
                    ({error: obj.error, id: obj.id, opts: opts}))
                .flatMap(obj => {
                    return appendFile(this, lines, priority)
                        .map(() => obj)
                        .flatMap(obj => releaseLock(this, obj.id))
                });
        })
        .catch(err => {
            console.error('\n', ' => add / enqueue error => \n', err.stack || err);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });

    if (isShare) {
        $add = $add.share();
        $add.subscribe();
    }

    return $add;

};


Queue.prototype.add = Queue.prototype.enq = Queue.prototype.enqueue = function (lines, opts) {

    opts = opts || {};

    if (opts.controlled) {
        return this._enqControlled(lines, opts);
    }

    const priority = opts.priority || 1;
    const isShare = opts.isShare !== false;

    lines = _.flattenDeep([lines]);

    let $add = this.init()
        .flatMap(() => {
            return acquireLock(this)
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
        });

    if (isShare) {
        $add = $add.share();
        $add.subscribe();
    }

    return $add;

};


Queue.prototype.remove = Queue.prototype.deq = Queue.prototype.dequeue = function (opts) {

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
            return acquireLock(this)
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
        });

    if (isConnect) {
        $dequeue = $dequeue.publish();
        $dequeue.connect();
    }

    return $dequeue;

};


Queue.prototype._deqWait = function (opts) {

    const count = opts.count;
    const isConnect = opts.isConnect !== false;
    const pattern = opts.pattern;
    const min = opts.min || count;

    assert(Array.isArray(opts.lines), ' => Implementation error => opts.lines should be an array');

    let $dequeue = this.init()
        .flatMap(() => {
            return acquireLock(this)
                .flatMap(obj => {
                    return acquireLockRetry(this, obj)
                })
                .map(obj =>
                    ({error: obj.error, id: obj.id, opts: opts}))
        })
        .flatMap(obj => {
            return removeMultipleLines(this, pattern, count)
                .map(lines => ({obj: obj, lines: lines}))
        })
        .flatMap(data => {

            const obj = data.obj;
            const lines = data.lines;
            obj.opts.lines = obj.opts.lines.concat(lines).filter(i => i);
            const len = obj.opts.lines.length;
            const diff = min - len;

            console.log('diff => ', diff);

            if (diff < 1) {
                console.log(colors.red(' => Greater than or equal to min => '), min);
                return releaseLock(this, obj.id)
                    .map(() => ({lines: obj.opts.lines}))
            }
            else {
                // we recurse out of necessity
                console.log('recursing...');
                return releaseLock(this, obj.id)
                    .flatMap(() => {
                        console.log('diff => ', diff);
                        return Rx.Observable.race(
                            // Rx.Observable.timer(8500).take(1)
                            //     .map(function(){
                            //         console.log('timer fired');
                            //     }),
                            // skip or bufferCount?
                            this.obsEnqueue.skip(diff + 3)
                                .map(function (d) {
                                    console.log(' obsEnqueue fired!!');
                                    return 1;
                                })
                        )
                    })
                    .flatMap(() => {
                        console.log(' LINES => ', colors.magenta(util.inspect(obj.opts.lines)));
                        return this._deqWait(obj.opts)
                    })
            }
        })
        .catch(e => {
            console.error(e.stack || e);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });

    if (isConnect) {
        $dequeue = $dequeue.publish();
        $dequeue.connect();
    }

    return $dequeue;

};

module.exports = Queue;
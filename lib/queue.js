'use striiiict';

//core
const util = require('util');
const fs = require('fs');
const path = require('path');

//npm
const Rx = require('rx-lite');
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

//TODO: https://www.learnrxjs.io/
//TODO: https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35#publish
//TODO: how to implement backpressure
//TODO: how to "cancel" an observable (maybe using filter?)
//TODO: there are Observables called empty/never, I am looking for one that is like "passthrough" stream
//TODO: if I get more than one line (perhaps via tail), then I want to take one observable and map it to
// many observables, how can that be done?

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
    removeOneLine,
    appendFile,
    makeGenericObservable,
    ifFileExistAndIsAllWhiteSpaceThenTruncate

} = require('./helpers');

///////////////////////////////////////////////////////////////////////////////////////////////////////////////


function Queue(obj) {

    const fp = this.filepath = obj.filepath || obj.filePath || obj.fp;
    this.lock = uuidV4();
    this.dateCreated = new Date();

    // this.obsEnqueue = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();

    let index = 0;

    let obsEnqueue = this.obsEnqueue = new Rx.Subject();

    this.queueStream = Rx.Observable.create(obs => {
        var push = Rx.Observer.create(v => {
            if ((index % obsEnqueue.observers.length) === obsEnqueue.observers.indexOf(push)) {
                obs.onNext(v);
            }
        });
        return obsEnqueue.subscribe(push);
    });

    this.push = (v) => {
        obsEnqueue.onNext(v);
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

    const ee = this.ee = new EE();

    // init both creates the queue file if it does not exist, and finds/initializes the live-mutex
    this.init = function (isPublish) {

        if (this.isReady) {
            return makeGenericObservable(null, {isPublish: isPublish});
        }

        if (!callable) {
            return makeEEObservable(ee, {isPublish: isPublish});
        }

        callable = false;

        const promise = lmUtils.conditionallyLaunchSocketServer({port: 7029});

        return Rx.Observable.fromPromise(promise)
            .flatMap(() => {
                this.client = new Client({port: 7029});
                return acquireLock(this)
                    .filter(obj => !obj.error);
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

                ee.emit('ready');

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
                        // this.obsEnqueue.onNext(d);
                    });

                });
            })
            .catch(e => {
                console.error(e.stack || e);
                return releaseLock(this);

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
            return acquireLock(this)
                .filter(obj => !obj.error)
        })
        .flatMap(obj => {
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
            return releaseLock(this);
        });


};

Queue.prototype.readAll = function () {
    return this.obsEnqueue;
};


Queue.prototype.add = Queue.prototype.enqueue = function (lines, opts) {

    opts = opts || {};

    const isShare = opts.isShare !== false;

    lines = _.flattenDeep([lines]);

    let $add = this.init()
        .flatMap(() => {
            return acquireLock(this)
                .filter(obj => !obj.error)
        })
        .flatMap(obj => {
            return appendFile(this, lines)
                .map(() => obj);
        })
        .flatMap(obj => releaseLock(this, obj.id))
        .catch(err => {
            console.error('\n', ' => add / enqueue error => \n', err.stack || err);
            return releaseLock(this);
        });

    if(isShare){
        $add = $add.share();
        $add.subscribe();
    }

    return $add;

};


Queue.prototype.remove = Queue.prototype.dequeue = function (opts) {

    opts = opts || {};

    const noOfLines = opts.noOfLines || 1;
    const isConnect = opts.isConnect !== false;

    let $dequeue = this.init()
        .flatMap(() => {
            return acquireLock(this)
                .filter(obj => !obj.error)
        })
        .flatMap(obj => {
            return removeOneLine(this)
                .map(l => ({l: l, id: obj.id}))
        })
        .flatMap(obj => {
            return releaseLock(this, obj.id)
                .map(() => obj.l)
        })
        .catch(e => {
            console.error(e.stack || e);
            return releaseLock(this);
        });

    if (isConnect) {
        $dequeue = $dequeue.publish();
        $dequeue.connect();
    }

    return $dequeue;

};

module.exports = Queue;
'use striiiict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

const debug = require('debug')('cmd-queue');

const EE = require('events');

const start = Date.now();

const Client = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');
const tail = require('./tail');

// READING =>
// http://reactivex.io/documentation/operators/backpressure.html
// https://gist.github.com/staltz/868e7e9bc2a7b8c1f754
// https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/backpressure.md
// http://stackoverflow.com/questions/41077300/rxjs-pause-upon-resume-give-last-paused-value

//TODO: https://www.learnrxjs.io/
//TODO: https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35#publish
//TODO: how to implement backpressure
//TODO: how to "cancel" an observable (maybe using filter?)
//TODO: there are Observables called empty/never, I am looking for one that is like "passthrough" stream
//TODO: if I get more than one line (perhaps via tail), then I want to take one observable and map it to
// many observables, how can that be done?

/*

 and finally:

 TODO

 // how to pass values "over" observables

 .flatMap(() => {
 lockAcquired = true;
 return removeOneLine(this);
 })
 .flatMap(val => {
 ret = val;
 return releaseLock(this);
 })
 .map(() => {
 if(ret){
 console.log('\n', colors.blue(' => ret =>'), colors.cyan(ret),'\n');
 return JSON.parse(ret);
 }
 })

 */


///////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

    this.obsEnqueue = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();


    // tail.on('error', function(error) {
    //     console.log('error => ', error);
    // });

    this.isReady = false;

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

        var lockAcquired = false;

        const promise = lmUtils.conditionallyLaunchSocketServer({port: 7029});

        return Rx.Observable.fromPromise(promise)
            .flatMap(() => {
                this.client = new Client({port: 7029});
                return acquireLock(this);
            })
            .flatMap(() => {
                lockAcquired = true;
                return ifFileExistAndIsAllWhiteSpaceThenTruncate(this)
            })
            .flatMap(() => {
                return genericAppendFile(this, '\n')
            })
            .flatMap(() => {
                return releaseLock(this)
            }).map(() => {

                ee.emit('ready');

                this.isReady = true;

                //start tailing, only after we know that the file exists, etc.
                tail(fp).on('data', data => {

                    console.log('\n', colors.cyan(' => raw data from tail => '), '\n', data);

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
                        this.obsEnqueue.onNext(d);
                    });

                });
            })
            .catch(e => {
                console.error(e.stack || e);
                if (lockAcquired) {
                    return releaseLock(this);
                }
                else {
                    return makeGenericObservable();
                }
            });
    };
}


Queue.prototype.dequeueStream = Queue.prototype.removeStream = function (pauser) {

    // let's do the same thing with lockAcquired?
    var lockAcquired = false;

    var obs = this.obsEnqueue;

    if (pauser) {
        obs = obs.pausableBuffered(pauser);
    }
    return obs.flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            return removeOneLine(this);
        })
        .flatMap(val => {
            return releaseLock(this)
                .map(() => {
                    if(val){
                        debug('\n', colors.blue(' => val => '), '\n', colors.cyan(util.inspect(val)), '\n');
                    }
                   return val;
                })
        })
        .catch(e => {
            console.error(e.stack || e);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return makeGenericObservable();
            }
        });


};

Queue.prototype.readAll = function () {
    return this.obsEnqueue;
};


Queue.prototype.add = Queue.prototype.enqueue = function (lines, opts) {

    opts = opts || {};

    const isPublish = opts.isPublish !== false;

    lines = _.flattenDeep([lines]);

    var lockAcquired = false;

    return this.init(isPublish)
        .flatMap(() => {
            return acquireLock(this)
        })
        .flatMap(() => {
            lockAcquired = true;
            return appendFile(this, lines)
        })
        .flatMap(() => releaseLock(this))
        .catch(err => {
            console.error(' => add / enqueue error => \n', err.stack || err);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return makeGenericObservable();
            }

        });
    // .publish();
    // .share();

};


Queue.prototype.remove = Queue.prototype.dequeue = function () {

    var lockAcquired = false;
    var line;

    return this.init()
        .flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            return removeOneLine(this);
        })
        .flatMap(l => {
            line = l;
            return releaseLock(this);
        })
        .map(() => {
            return line;
        })
        .catch(e => {
            console.error(e.stack || e);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return makeGenericObservable();
            }
        });

};

module.exports = Queue;
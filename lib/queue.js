'use striiiict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

const EE = require('events');

const start = Date.now();

const Client = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');
const tail = require('./tail');


//TODO: how to implement backpressure
//TODO: how to "cancel" an observable
//TODO: there are Observables called empty/never, I am looking for one that is like "passthrough" stream

/*

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
    this.init = function () {

        if (this.isReady) {
            return makeGenericObservable();
        }

        if(!callable){
            return makeEEObservable(ee);
        }

        callable = false;

        var lockAcquired = false;

        const promise = lmUtils.conditionallyLaunchSocketServer({port: 7029});

        return Rx.Observable.fromPromise(promise)
            .map(() => {
                this.client = new Client({port: 7029});
            })
            .flatMap(() => {
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

                //start tailing, only after we know that file exists, etc.
                tail(fp).on('data', data => {

                    console.log('\n', colors.cyan(' => raw data from tail => '),'\n', data);

                    data = String(data).split('\n');

                    data.map(function (d) {

                        try {
                            return JSON.parse(String(d).trim());
                        }
                        catch (err) {
                            return '';
                        }

                    }).filter(function (d) {
                        return String(d).trim().length > 0;
                    }).forEach(d => {
                        console.log('\n', colors.cyan(' => data from tail => '),'\n', d);
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


Queue.prototype.readUnique = function () {

    var ret = null;
    var lockAcquired = false;

    // return this.init()
    //     .flatMap(() => this.obsEnqueue)

    return this.obsEnqueue
        .flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            return removeOneLine(this);
        })
        .flatMap(val => {
            ret = val;
            return releaseLock(this);
        })
        .map(() => {
            if (ret) {
                console.log('\n', colors.blue(' => ret =>'), colors.cyan(ret), '\n');
                return JSON.parse(ret);
            }
        })
        .catch(e => {
            console.log(colors.bgRed('error time => '), Date.now() - start);
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


Queue.prototype.add = Queue.prototype.enqueue = function (lines) {

    lines = _.flattenDeep([lines]);

    var lockAcquired = false;

    return this.init()
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
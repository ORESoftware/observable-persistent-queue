'use striiiict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const lockFile = require('lockfile');

// const lockFile = require('./lockfile-stub');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const Broker = require('live-mutex/broker');
const Client = require('live-mutex/client');

const b = new Broker();
const client = new Client();
const colors = require('colors/safe');

const start = Date.now();

/*

 opts.wait

 A number of milliseconds to wait for locks to expire before giving up.
 Only used by lockFile.lock. Poll for opts.wait ms.
 If the lock is not cleared by the time the wait expires, then it returns with the original error.

 opts.pollPeriod

 When using opts.wait, this is the period in ms in which it polls to check if the lock has expired.
 Defaults to 100.

 opts.stale

 A number of milliseconds before locks are considered to have expired.

 opts.retries

 Used by lock and lockSync. Retry n number of times before giving up.

 opts.retryWait

 Used by lock. Wait n milliseconds before retrying.


 */


function removeOneLine(queue) {

    return readFile(queue)
        .flatMap(data => {
            // split by newline and filter out empty lines
            const lines = String(data).split('\n').filter(l => String(l).trim().length);
            var l = lines.shift();
            if (!l) {
                return Rx.Observable.create(obs => {
                    obs.onNext(null);
                });
            }
            l = l.trim();
            const d = '\n' + lines.join('\n') + '\n';
            return writeFile(queue, d)
            //return line that got shifted off queue
                .flatMap(() => {
                    return Rx.Observable.create(obs => {
                        console.log('line popped from file => ', l);
                        obs.onNext(l);
                    })
                });

        });
}

function writeFile(queue, data) {

    const filePath = queue.filepath;

    return Rx.Observable.create(obs => {
        fs.writeFile(filePath, data, err => {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
    });

}

var count = 0;

function appendFile(queue, lines) {

    const filePath = queue.filepath;

    //ensure new line separation
    lines = lines.map(function (l) {
        return JSON.stringify({
            pid: process.pid,
            count: count++,
            line: l,
            uid: uuidV4(),
            isRead: false
        });
    });

    const data = '\n' + lines + '\n';

    return Rx.Observable.create(obs => {
        fs.appendFile(filePath, data, err => {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext(lines);
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
    });

}


function genericAppendFile(queue, data) {

    const d = data || '';
    const fp = queue.filepath;

    return Rx.Observable.create(obs => {
        // try to open file for reading and writing
        // fs.writeFile(fp, d, {flag: 'w+'}, err => {
        fs.appendFile(fp, d, {}, err => {
            if (err) {
                console.log('error => ', err.stack);
                obs.onError(err);
            }
            else {
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing genericAppendFile()');
        }
    });

}

const opts = {
    wait: 3000,
    stale: 2000,
    pollPeriod: 80,
    retries: 100,
    retryWait: 50
};


function acquireLock(queue) {

    const lock = queue.lock;

    return Rx.Observable.create(obs => {

        client.lock(lock).then(
            function () {
                acquireLockCount++;
                obs.onNext();
                obs.onCompleted();
            },
            obs.onError);

        return function () {
            // console.log('disposing acquireLock()');
        }
    });
}

// function acquireLock(queue) {
//
//     const lock = queue.lock;
//
//     return Rx.Observable.create(obs => {
//         lockFile.lock(lock, opts, function (err) {
//             if (err) {
//                 console.log(' !!!!!!!!!!!!!! error acquiring lock => ', err.stack || err);
//                 console.log(util.inspect({
//                     acquireLockCount: acquireLockCount,
//                     releaseLockCount: releaseLockCount
//                 }));
//                 obs.onError(err);
//             }
//             else {
//                 acquireLockCount++;
//                 obs.onNext();
//                 obs.onCompleted();
//             }
//         });
//
//         return function () {
//             // console.log('disposing acquireLock()');
//         }
//     });
// }


function readFile(queue) {

    const fp = queue.filepath;
    return Rx.Observable.create(obs => {
        fs.readFile(fp, 'utf8', function (err, data) {
            if (err) {
                console.log('errrror => ', err.stack);
                obs.onError(err);
            }
            else {
                obs.onNext(data);
                obs.onCompleted();
            }

        });
        return function () {
            // console.log('disposing readFile()');
        }
    });
}


var releaseLockCount = 0;
var acquireLockCount = 0;


function releaseLock(queue) {

    return Rx.Observable.create(obs => {

        const lock = queue.lock;

        client.unlock(lock).then(
            function () {
                releaseLockCount++;
                obs.onNext();
                obs.onCompleted();
            },
            obs.onError);

        return function () {
            // console.log('disposing releaseLock()');
        }
    });
}

// function releaseLock(queue) {
//
//     return Rx.Observable.create(obs => {
//
//         const lock = queue.lock;
//
//         lockFile.unlock(lock, function () {
//             releaseLockCount++;
//             fs.unlink(lock, function (err) {
//                 if (err && !String(err.stack || err).match(/no such file or directory/i)) {
//                     console.error(err.stack || err);
//                     obs.onError(err);
//                 }
//                 else {
//                     obs.onNext();
//                     obs.onCompleted();
//                 }
//             });
//         });
//
//         return function () {
//             // console.log('disposing releaseLock()');
//         }
//     });
// }


function Queue(obj) {

    const fp = this.filepath = obj.filepath;
    this.lock = path.resolve(fp + '.lock');
    this.dateCreated = new Date();

    const values = [];   // in memory queue, trying to make this private data for the instance
    this.obsEnqueue = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();

    this._push = function (val) {
        values.push(val);
        this.obsEnqueue.onNext(val);
    };

    this._shift = function () {
        const val = values.shift();
        if (val) {
            this.obsDequeue.onNext(val);
        }
    };


    this.isReady = false;

    this.init = function () {

        if (this.isReady) {
            return genericObservable();
        }

        var lockAcquired = false;

        return acquireLock(this)
            .flatMap(() => genericAppendFile(this, ''))
            .flatMap(() => {
                lockAcquired = true;
                return releaseLock(this)
            })
            .catch(e => {
                console.error(e.stack || e);
                if (lockAcquired) {
                    return releaseLock(this);
                }
                else {
                    return genericObservable();
                }
            })
            .finally(() => {
                this.isReady = true;
            });
    };
}


Queue.prototype.peek = function () {
    return this.values[0];
};


Queue.prototype.readUnique = function () {

    var ret = null;
    var lockAcquired = false;

    return this.obsEnqueue
        .flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            console.log(util.inspect({
                acquireLockCount: acquireLockCount,
                releaseLockCount: releaseLockCount
            }));
            return removeOneLine(this);
        })
        .flatMap(val => {
            ret = val;
            console.log('\n', colors.yellow(' => ret =>'), ret,'\n');
            return releaseLock(this);
        })
        .map(() => {
            return JSON.parse(ret);
        })
        .catch(e => {
            console.log('error time => ', Date.now() - start);
            console.error('ZZZZZ', e.stack || e);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return genericObservable();
            }
        });

};

Queue.prototype.readAll = function () {

    return this.obsEnqueue
        .map(val => {
            return JSON.parse(val);
        });

};

function genericObservable(fn) {
    return Rx.Observable.create(obs => {
        if (!fn) {
            return process.nextTick(function () {
                obs.onNext();
                obs.onCompleted();
            });
        }
        fn(function (err, val) {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext(val);
                obs.onCompleted();
            }
        });
    });
}


Queue.prototype.add = function (lines) {

    lines = _.flattenDeep([lines]);

    var lockAcquired = false;

    return this.init()
        .flatMap(() => {
            console.log('\n',colors.yellow(' => acquiring lock...'),'\n');
            return acquireLock(this)
        })
        .flatMap(() => {
            lockAcquired = true;
            return appendFile(this, lines)
        })
        .flatMap(lines => {
            return genericObservable(cb => {
                lines.forEach(l => this._push(l));
                cb(null);
            });
        })
        .flatMap(() => releaseLock(this))
        .catch(err => {
            console.error('ADD ERROR => ', err.stack || err);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return genericObservable();
            }
        });

};


Queue.prototype.dequeue = function () {

    var lockAcquired = false;

    return this.init()
        .flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            return removeOneLine(this)
        })
        .flatMap(l => releaseLock(this))
        .catch(e => {
            console.error(e.stack || e);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return genericObservable();
            }
        });

};

module.exports = Queue;
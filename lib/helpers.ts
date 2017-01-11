'use strict';

//core
import util = require('util');
import fs = require('fs');
import path = require('path');
import assert = require('assert');
import cp = require('child_process');

//npm
import Rx = require('rxjs');
import _ = require('lodash');
import uuidV4 = require('uuid/v4');
import colors = require('colors/safe');

//project
import sed = require('./sed');
import _countLines = require('./count-lines');
const debug = require('debug')('cmd-queue');
const a = require('./test');

/////////////////////////////////////////////////////////////////////////////////////////////

const start = Date.now();
let drainLocks = 0;
let drainUnlocks = 0;
let releaseLockCount = 0;
let acquireLockCount = 0;
let count = 0;

/////////////////////////////////////////////////////////////////////////////////////////////

// TODO: http://askubuntu.com/questions/509881/tail-reading-an-entire-file-and-then-following

/////////////////////////////////////////////////////////////////////////////////////////////

export function makeEEObservable(queue: any, ee: any, opts: any) {

    opts = opts || {};
    const isCallCompleted = opts.isCallCompleted;
    const isPublish = opts.isPublish;

    let obs = Rx.Observable.create(obs => {

        if (queue.isReady) {
            // this seemingly superfluous check prevents race conditions in the case that
            // the "executor" function is not called synchronously
            obs.next();
            if (isCallCompleted) {
                obs.complete();
            }
        }
        else {
            ee.once('error', function (err) {
                obs.error(err)
            });
            ee.once('ready', function () {
                obs.next();
                if (isCallCompleted) {
                    obs.complete();
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
}

export function makeGenericObservable(fn: any, opts: any) {

    opts = opts || {};
    const isCallCompleted = opts.isCallCompleted;
    const isPublish = opts.isPublish;

    let obs = Rx.Observable.create(obs => {
        if (fn) {
            fn(function (err, val) {
                if (err) {
                    obs.error(err);
                }
                else {
                    obs.next(val);
                    if (isCallCompleted) {
                        obs.complete();
                    }

                }
            });
        }
        else {
            process.nextTick(function () {
                obs.next();
                if (isCallCompleted) {
                    obs.complete();
                }
            });
        }

    });

    if (isPublish) {
        obs = obs.publish().refCount();
    }
    return obs;
}


export function countLines(queue: any, pattern: any) {
    return _countLines(queue.fp, pattern);
}


export function findFirstLine(queue: any, pattern: any) {

    pattern = pattern || '\\S+';

    const count = 1;

    return sed(queue, pattern, 'false', count)
        .map(data => {
            return data[0];
        });
}


export function removeOneLine(queue: any, pattern: any) {

    pattern = pattern || '\\S+';

    const count = 1;

    return sed(queue, pattern, 'true', count)
        .map(data => {
            if (data.length > 1) {
                console.error(colors.red(' => OPQ Implementation Warning => ' +
                    'removeOneLine data had a length greater than 1.'));
            }
            return data[0];
        });
}


export function removeMultipleLines(queue: any, pattern: any, count: any) {

    return sed(queue, pattern, 'true', count)
        .map(data => {
            assert(Array.isArray(data),
                ' => Implementation error => data should be in an array format.');
            return data;
        });

}

export function writeFile(queue: any, data: any) {

    const filePath = queue.fp;
    data = data || '';

    return Rx.Observable.create(obs => {
        fs.writeFile(filePath, data, err => {
            if (err) {
                obs.error(err);
            }
            else {
                obs.next();
                obs.complete();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
    });

}


export function appendFile(queue: any, lines: any, priority: any) {

    const filePath = queue.fp;

    assert(Number.isInteger(priority), ' => Implementation error => "priority" must be an integer.');

    //ensure new line separation
    lines = lines.map(function (l) {

        assert.equal(typeof l, 'string');
        assert(!l.match(/:/), ' => Usage error => You cannot use colon characters in your queue messages, ' +
            'as OPQ uses colons to easily delineate JSON.');

        return JSON.stringify({
            dateCreated: new Date().toISOString(),
            pid: process.pid,
            count: count++,
            uid: uuidV4(),
            priority: priority,
            isRead: false,
            line: l
        });
    });

    const data = lines.join('\n') + '\n';

    return Rx.Observable.create(obs => {
        fs.appendFile(filePath, data, {flag: 'a'}, err => {
            if (err) {
                obs.error(err);
            }
            else {
                obs.next(lines);
                obs.complete();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
    });

}

export function delayObservable(delay: any, isCompleted: any) {
    return Rx.Observable.create(obs => {
        setTimeout(function () {
            obs.next();
            if (isCompleted) {
                obs.complete();
            }
        }, delay || 100);
    });
}

export function ifFileExistAndIsAllWhiteSpaceThenTruncate(queue: any) {

    return readFile(queue)
        .flatMap(data => {
            if (data) {
                return makeGenericObservable(null, null);
            }
            else {
                // if not data, then we truncate file
                return writeFile(queue, null);
            }
        });

}


export function genericAppendFile(queue: any, data: any) {

    const d = data || '';
    const fp = queue.filepath;

    return Rx.Observable.create(obs => {
        // try to open file for reading and writing
        // fs.writeFile(fp, d, {flag: 'w+'}, err => {
        fs.appendFile(fp, d, {}, err => {
            if (err) {
                console.log(' => OPQ append file error => ', err.stack);
                obs.error(err);
            }
            else {
                obs.next();
                obs.complete();
            }
        });

        return function () {
            // console.log('disposing genericAppendFile()');
        }
    });
}

export function acquireLockRetry(queue: any, obj: any) {

    if (!obj.error) {
        return makeGenericObservable(null, null)
            .map(() => obj);
    }

    console.log('\n\n', colors.red(' => need to retry acquiring lock.'), '\n\n');

    return Rx.Observable.interval(3500)
        .takeUntil(
            // take until either the timeout occurs or we actually acquire the lock
            Rx.Observable.race(
                acquireLock(queue, obj.name)
                    .filter(obj => !obj.error),

                Rx.Observable.timer(2600)
                    .flatMap(() => {
                        return Rx.Observable.throw(' => Rx.Observable.throw => acquire lock timed out')
                    })
            )
        )

}


export function backpressure(queue: any, val: any, fn: any) {

    return Rx.Observable.create(sub => {

        fn.call(sub, function (err, ret) {
            if (err) {
                sub.error(err);
            }
            else {
                sub.next(ret);
                process.nextTick(function () {
                    val.cb();
                });
            }
        });

        return function () {

        }
    });
}


export function readFile$(queue: any) {

    const fp = queue.filepath;

    return Rx.Observable.create(obs => {
        fs.readFile(fp, 'utf8', function (err, data) {
            if (err) {
                console.log('errrror => ', err.stack);
                obs.error(err);
            }
            else {
                obs.next(data);
                obs.complete();
            }

        });
        return function () {
            // console.log('disposing readFile()');
        }
    });
}


export function readFile(queue: any) {

    const fp = queue.filepath;

    return Rx.Observable.create(obs => {

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
                console.error(colors.red(' => grep exit code is greater than 0 => '), code, ' => stdout => ', '"' + data + '"');
                obs.error({
                    'grep-exit-code': code
                });
            }
            else {

                if (data) {
                    console.log('\n', colors.blue(' => data is as data do => '), '\n', data);
                }

                obs.next(data);
                obs.complete();

            }

        });

        return function () {

        }

    });

}


export function waitForClientCount(queue: any, opts: any) {

    opts = opts || {};
    const count = opts.count || 5;
    const timeout = opts.timeout || 3000;

    const index = opts.index;

    return queue.obsClient.bufferCount(count)
        .flatMap(value => {

            const first = value.shift();
            const last = value[value.length - 1];

            if (opts.index > 3 || (last.clientCount - first.clientCount < 2)) {
                return Rx.Observable.timer(10)
            }
            else {
                opts.index = opts.index || 0;
                opts.index++;
                return waitForClientCount.apply(null, [queue, opts]);
            }

        });
}


export function acquireLock(queue: any, name: any) {

    const lock = queue.lock;
    const client = queue.client;

    if (typeof name !== 'string') {
        throw new Error(' => OPQ implementation error => no name for mutex append.');
    }

    return Rx.Observable.create(obs => {

        client.lock(lock, {append: name}, function (err, unlock, id) {
            if (err) {
                console.error('\n\n', ' => Error acquiring lock => \n', (err.stack || err));
            }
            else {
                acquireLockCount++;

                if (String(name).startsWith('<drain')) {
                    drainLocks++;
                    console.log('\n\n', 'drain locks/unlocks (locking) => ', drainLocks, drainUnlocks, '\n\n');
                }
            }


            debug(util.inspect({
                acquireLockCount: acquireLockCount,
                releaseLockCount: releaseLockCount
            }));

            obs.next({
                error: err ? (err.stack || err) : undefined,
                id: id,
                name: name
            });

            obs.complete();

        });

        return function () {
            // console.log('disposing acquireLock()');
        }
    });
}

export function releaseLock(queue: any, lockUuid: any) {

    const client = queue.client;

    if (!lockUuid) {
        console.error('\n\n', new Error('Cannot release lock without force or proper uuid.').stack, '\n\n');
        return Rx.Observable.throw('Cannot release lock without force or proper uuid.\n\n');
    }


    if (String(lockUuid).startsWith('<drain')) {
        drainUnlocks++;
        console.log('\n\n', 'drain locks/unlocks => ', drainLocks, drainUnlocks, '\n\n');
    }

    return Rx.Observable.create(obs => {

        const lock = queue.lock;

        client.unlock(lock, lockUuid, function (err) {

            if (err) {
                console.error('\n', ' => Release lock error => ', '\n', err.stack || err);
            }
            else {
                releaseLockCount++;
            }

            obs.next({
                error: err ? (err.stack || err) : undefined
            });

            obs.complete();

        });

        return function () {
            // console.log('disposing releaseLock()');
        }
    });
}

'use strict';
const util = require("util");
const fs = require("fs");
const assert = require("assert");
const cp = require("child_process");
const Rx = require("rxjs");
const uuidV4 = require("uuid/v4");
const colors = require("colors/safe");
const rxjs_1 = require("rxjs");
const sed = require("./sed");
const _countLines = require("./count-lines");
const debug = require('debug')('cmd-queue');
const a = require('./test');
const start = Date.now();
let drainLocks = 0;
let drainUnlocks = 0;
let releaseLockCount = 0;
let acquireLockCount = 0;
let count = 0;
function makeEEObservable(q, ee, opts) {
    opts = opts || {};
    const isCallCompleted = opts.isCallCompleted;
    const isPublish = opts.isPublish;
    let obs = rxjs_1.Observable.create(obs => {
        if (q.isReady) {
            obs.next();
            if (isCallCompleted) {
                obs.complete();
            }
        }
        else {
            ee.once('error', function (err) {
                obs.error(err);
            });
            ee.once('ready', function () {
                obs.next();
                if (isCallCompleted) {
                    obs.complete();
                }
            });
        }
        return function () {
        };
    });
    if (isPublish) {
        obs = obs.publish().refCount();
    }
    return obs;
}
exports.makeEEObservable = makeEEObservable;
function makeGenericObservable(fn, opts) {
    opts = opts || {};
    const isCallCompleted = opts.isCallCompleted;
    const isPublish = opts.isPublish;
    let obs = rxjs_1.Observable.create(obs => {
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
exports.makeGenericObservable = makeGenericObservable;
function countLines(q, pattern) {
    return _countLines(q.fp, pattern);
}
exports.countLines = countLines;
function findFirstLine(q, pattern) {
    pattern = pattern || '\\S+';
    const count = 1;
    return sed(q, pattern, false, count)
        .map(data => {
        return data[0];
    });
}
exports.findFirstLine = findFirstLine;
function removeOneLine(q, pattern) {
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
}
exports.removeOneLine = removeOneLine;
function removeMultipleLines(q, pattern, count) {
    return sed(q, pattern, true, count)
        .map(data => {
        assert(Array.isArray(data), ' => Implementation error => data should be in an array format.');
        return data;
    });
}
exports.removeMultipleLines = removeMultipleLines;
function writeFile(q, data) {
    const filePath = q.fp;
    data = data || '';
    return rxjs_1.Observable.create(obs => {
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
        };
    });
}
exports.writeFile = writeFile;
function appendFile(q, lines, priority) {
    const filePath = q.fp;
    assert(Number.isInteger(priority), ' => Implementation error => "priority" must be an integer.');
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
    const data = '\n' + lines.join('\n') + '\n';
    return rxjs_1.Observable.create(obs => {
        fs.appendFile(filePath, data, { flag: 'a' }, err => {
            if (err) {
                obs.error(err);
            }
            else {
                obs.next(lines);
                obs.complete();
            }
        });
        return function () {
        };
    });
}
exports.appendFile = appendFile;
function delayObservable(delay, isCompleted) {
    return rxjs_1.Observable.create(obs => {
        setTimeout(function () {
            obs.next();
            if (isCompleted) {
                obs.complete();
            }
        }, delay || 100);
    });
}
exports.delayObservable = delayObservable;
function ifFileExistAndIsAllWhiteSpaceThenTruncate(q) {
    return readFile(q)
        .flatMap(data => {
        if (data) {
            return makeGenericObservable();
        }
        else {
            return writeFile(q);
        }
    });
}
exports.ifFileExistAndIsAllWhiteSpaceThenTruncate = ifFileExistAndIsAllWhiteSpaceThenTruncate;
function genericAppendFile(q, data) {
    const d = data || '';
    const fp = q.filepath;
    return rxjs_1.Observable.create(obs => {
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
        };
    });
}
exports.genericAppendFile = genericAppendFile;
function acquireLockRetry(q, obj) {
    if (!obj.error) {
        return makeGenericObservable(null, null)
            .map(() => obj);
    }
    console.log('\n\n', colors.red(' => need to retry acquiring lock.'), '\n\n');
    return rxjs_1.Observable.interval(3500)
        .takeUntil(rxjs_1.Observable.race(acquireLock(q, obj.name)
        .filter(obj => !obj.error), rxjs_1.Observable.timer(2600)
        .flatMap(() => {
        return Rx.Observable.throw(' => Rx.Observable.throw => acquire lock timed out');
    })));
}
exports.acquireLockRetry = acquireLockRetry;
function backpressure(q, val, fn) {
    return rxjs_1.Observable.create(sub => {
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
        };
    });
}
exports.backpressure = backpressure;
function readFile$(q) {
    const fp = q.filepath;
    return rxjs_1.Observable.create(obs => {
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
        };
    });
}
exports.readFile$ = readFile$;
function readFile(q) {
    const fp = q.filepath;
    return rxjs_1.Observable.create(obs => {
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
        };
    });
}
exports.readFile = readFile;
function waitForClientCount(q, opts) {
    opts = opts || {};
    const count = opts.count || 5;
    const timeout = opts.timeout || 3000;
    const index = opts.index;
    return q.obsClient.bufferCount(count)
        .flatMap(value => {
        const first = value.shift();
        const last = value[value.length - 1];
        if (opts.index > 3 || (last.clientCount - first.clientCount < 2)) {
            return rxjs_1.Observable.timer(10);
        }
        else {
            opts.index = opts.index || 0;
            opts.index++;
            return waitForClientCount.apply(null, [q, opts]);
        }
    });
}
exports.waitForClientCount = waitForClientCount;
function acquireLock(q, name) {
    const lock = q.lock;
    const client = q.client;
    if (typeof name !== 'string') {
        throw new Error(' => OPQ implementation error => no name for mutex append.');
    }
    return rxjs_1.Observable.create(obs => {
        client.lock(lock, { append: name }, function (err, unlock, id) {
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
            obs.next({
                error: err ? (err.stack || err) : undefined,
                id: id,
                name: name
            });
            obs.complete();
        });
        return function () {
        };
    });
}
exports.acquireLock = acquireLock;
function releaseLock(q, lockUuid) {
    const client = q.client;
    if (!lockUuid) {
        console.error('\n\n', new Error('Cannot release lock without force or proper uuid.').stack, '\n\n');
        return rxjs_1.Observable.throw('Cannot release lock without force or proper uuid.\n\n');
    }
    if (String(lockUuid).startsWith('<drain')) {
        drainUnlocks++;
        debug('\n\n', 'drain locks/unlocks => ', drainLocks, drainUnlocks, '\n\n');
    }
    return rxjs_1.Observable.create(obs => {
        const lock = q.lock;
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
        };
    });
}
exports.releaseLock = releaseLock;

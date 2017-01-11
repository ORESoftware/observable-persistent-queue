'use strict';
var util = require("util");
var fs = require("fs");
var assert = require("assert");
var cp = require("child_process");
var Rx = require("rxjs");
var uuidV4 = require("uuid/v4");
var colors = require("colors/safe");
var sed = require("./sed");
var debug = require('debug')('cmd-queue');
var countLines = require("./count-lines");
var start = Date.now();
var releaseLockCount = 0;
var acquireLockCount = 0;
var count = 0;
exports.makeEEObservable = function _makeEEObservable(queue, ee, opts) {
    opts = opts || {};
    var isCallCompleted = opts.isCallCompleted;
    var isPublish = opts.isPublish;
    var obs = Rx.Observable.create(function (obs) {
        if (queue.isReady) {
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
};
var makeGenericObservable = exports.makeGenericObservable = function _makeGenericObservable(fn, opts) {
    opts = opts || {};
    var isCallCompleted = opts.isCallCompleted;
    var isPublish = opts.isPublish;
    var obs = Rx.Observable.create(function (obs) {
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
};
exports.countLines = function _countMatchingLines(queue, pattern) {
    return countLines(queue.fp, pattern);
};
exports.findFirstLine = function _findFirstLine(queue, pattern) {
    pattern = pattern || '\\S+';
    var count = 1;
    return sed(queue, pattern, 'false', count)
        .map(function (data) {
        return data[0];
    });
};
exports.removeOneLine = function _removeOneLine(queue, pattern) {
    pattern = pattern || '\\S+';
    var count = 1;
    return sed(queue, pattern, 'true', count)
        .map(function (data) {
        if (data.length > 1) {
            console.error(colors.red(' => Warning => removeOneLine data had a length greater than 1.'));
        }
        return data[0];
    });
};
exports.removeMultipleLines = function _removeMultipleLines(queue, pattern, count) {
    return sed(queue, pattern, 'true', count)
        .map(function (data) {
        assert(Array.isArray(data), ' => Implementation error => data should be in an array format.');
        return data;
    });
};
var writeFile = exports.writeFile = function _writeFile(queue, data) {
    var filePath = queue.fp;
    data = data || '';
    return Rx.Observable.create(function (obs) {
        fs.writeFile(filePath, data, function (err) {
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
};
exports.appendFile = function _appendFile(queue, lines, priority) {
    var filePath = queue.fp;
    assert(Number.isInteger(priority), ' => Implementation error => "priority" must be an integer.');
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
    var data = lines.join('\n') + '\n';
    return Rx.Observable.create(function (obs) {
        fs.appendFile(filePath, data, { flag: 'a' }, function (err) {
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
};
exports.delayObservable = function (delay, isCompleted) {
    return Rx.Observable.create(function (obs) {
        setTimeout(function () {
            obs.next();
            if (isCompleted) {
                obs.complete();
            }
        }, delay || 100);
    });
};
exports.ifFileExistAndIsAllWhiteSpaceThenTruncate = function (queue) {
    return readFile(queue)
        .flatMap(function (data) {
        if (data) {
            return makeGenericObservable(null, null);
        }
        else {
            return writeFile(queue, null);
        }
    });
};
exports.obviousObservable = function _obviousObservable() {
    return Rx.Observable.create(function (obs) {
        process.nextTick(function () {
            obs.next();
        });
    });
};
exports.genericAppendFile = function _genericAppendFile(queue, data) {
    var d = data || '';
    var fp = queue.filepath;
    return Rx.Observable.create(function (obs) {
        fs.appendFile(fp, d, {}, function (err) {
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
};
exports.acquireLockRetry = function _acquireLockRetry(queue, obj) {
    if (!obj.error) {
        return makeGenericObservable(null, null)
            .map(function () { return obj; });
    }
    console.log('\n\n', colors.red(' => need to retry acquiring lock.'), '\n\n');
    return Rx.Observable.interval(3500)
        .takeUntil(Rx.Observable.race(acquireLock(queue, obj.name)
        .filter(function (obj) { return !obj.error; }), Rx.Observable.timer(2600)
        .flatMap(function () {
        return Rx.Observable.throw(' => Rx.Observable.throw => acquire lock timed out');
    })));
};
exports.backpressure = function (queue, val, fn) {
    return Rx.Observable.create(function (sub) {
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
};
var readFile$ = exports.readFile$ = function _readFile(queue) {
    var fp = queue.filepath;
    return Rx.Observable.create(function (obs) {
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
};
var readFile = exports.readFile = function (queue) {
    var fp = queue.filepath;
    return Rx.Observable.create(function (obs) {
        var n = cp.spawn('grep', ['-m', '1', '-E', '\\S+', fp]);
        var data = '';
        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');
        n.stdout.on('data', function (d) {
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
};
exports.waitForClientCount = function _waitForClientCount(queue, opts) {
    opts = opts || {};
    var count = opts.count || 5;
    var timeout = opts.timeout || 3000;
    var index = opts.index;
    return queue.obsClient.bufferCount(count)
        .flatMap(function (value) {
        var first = value.shift();
        var last = value[value.length - 1];
        if (opts.index > 3 || (last.clientCount - first.clientCount < 2)) {
            return Rx.Observable.timer(10);
        }
        else {
            opts.index = opts.index || 0;
            opts.index++;
            return _waitForClientCount.apply(null, [queue, opts]);
        }
    });
};
var drainLocks = 0;
var drainUnlocks = 0;
var acquireLock = exports.acquireLock = function _acquireLock(queue, name) {
    var lock = queue.lock;
    var client = queue.client;
    if (typeof name !== 'string') {
        throw new Error(' => OPQ implementation error => no name for mutex append.');
    }
    return Rx.Observable.create(function (obs) {
        client.lock(lock, { append: name }, function (err, unlock, id) {
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
        };
    });
};
exports.releaseLock = function _releaseLock(queue, lockUuid) {
    var client = queue.client;
    if (!lockUuid) {
        console.error('\n\n', new Error('Cannot release lock without force or proper uuid.').stack, '\n\n');
        return Rx.Observable.throw('Cannot release lock without force or proper uuid.\n\n');
    }
    if (String(lockUuid).startsWith('<drain')) {
        drainUnlocks++;
        console.log('\n\n', 'drain locks/unlocks => ', drainLocks, drainUnlocks, '\n\n');
    }
    return Rx.Observable.create(function (obs) {
        var lock = queue.lock;
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
};

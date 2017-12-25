'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var fs = require("fs");
var assert = require("assert");
var cp = require("child_process");
var Rx_1 = require("rxjs/Rx");
var _ = require("lodash");
var uuidV4 = require("uuid/v4");
var colors = require("colors/safe");
var sed_1 = require("./sed");
var _countLines = require("./count-lines");
var debug = require('debug')('cmd-queue');
var start = Date.now();
var drainLocks = 0;
var drainUnlocks = 0;
var releaseLockCount = 0;
var acquireLockCount = 0;
var count = 0;
exports.makeEEObservable = function (q, ee, opts) {
    opts = opts || {};
    var isCallCompleted = opts.isCallCompleted;
    var isPublish = opts.isPublish;
    var obs = Rx_1.Observable.create(function (sub) {
        if (q.isReady) {
            sub.next();
            if (true || isCallCompleted) {
                sub.complete();
            }
        }
        else {
            ee.once('error', function (err) {
                sub.error(err);
            });
            ee.once('ready', function () {
                sub.next();
                if (true || isCallCompleted) {
                    sub.complete();
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
exports.makeGenericObservable = function (fn, opts) {
    opts = opts || {};
    var isCallCompleted = opts.isCallCompleted;
    var isPublish = opts.isPublish;
    var obs = Rx_1.Observable.create(function (sub) {
        if (fn) {
            fn(function (err, val) {
                if (err) {
                    sub.error(err);
                }
                else {
                    sub.next(val);
                    if (true || isCallCompleted) {
                        sub.complete();
                    }
                }
            });
        }
        else {
            process.nextTick(function () {
                sub.next();
                if (true || isCallCompleted) {
                    sub.complete();
                }
            });
        }
    });
    if (isPublish) {
        obs = obs.publish().refCount();
    }
    return obs;
};
exports.countLines = function (q, pattern) {
    return _countLines(q.fp, pattern);
};
exports.findFirstLine = function (q, pattern) {
    pattern = pattern || '\\S+';
    var count = 1;
    return sed_1.sed(q, pattern, false, count)
        .map(function (data) {
        return data[0];
    });
};
exports.removeOneLine = function (q, pattern) {
    pattern = pattern || '\\S+';
    var count = 1;
    return sed_1.sed(q, pattern, true, count)
        .map(function (data) {
        if (data.length > 1) {
            console.error(colors.red(' => OPQ Implementation Warning => ' +
                'removeOneLine data had a length greater than 1.'));
        }
        return data[0];
    });
};
exports.removeMultipleLines = function (q, pattern, count) {
    return sed_1.sed(q, pattern, true, count)
        .map(function (data) {
        assert(Array.isArray(data), ' => Implementation error => data should be in an array format.');
        return data;
    });
};
exports.writeFile = function (q, data) {
    var filePath = q.fp;
    data = data || '';
    return Rx_1.Observable.create(function (sub) {
        fs.writeFile(filePath, data, function (err) {
            if (err) {
                return sub.error(err);
            }
            sub.next();
            sub.complete();
        });
        return function () {
        };
    });
};
exports.appendFile = function (q, $lines, priority) {
    var filePath = q.fp;
    assert(Number.isInteger(priority), ' => Implementation error => "priority" must be an integer.');
    var lines = _.flattenDeep([$lines]);
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
    var data = lines.join('\n') + '\n';
    return Rx_1.Observable.create(function (sub) {
        fs.appendFile(filePath, data, { flag: 'a' }, function (err) {
            if (err) {
                return sub.error(err);
            }
            sub.next(lines);
            sub.complete();
        });
        return function () {
        };
    });
};
exports.delayObservable = function (delay, isCompleted) {
    return Rx_1.Observable.create(function (sub) {
        setTimeout(function () {
            sub.next();
            if (isCompleted) {
                sub.complete();
            }
        }, delay || 100);
    });
};
exports.ifFileExistAndIsAllWhiteSpaceThenTruncate = function (q) {
    return exports.readFile(q)
        .flatMap(function (data) {
        if (data) {
            return exports.makeGenericObservable();
        }
        else {
            return exports.writeFile(q);
        }
    });
};
exports.genericAppendFile = function (q, data) {
    var d = data || '';
    var fp = q.filepath;
    return Rx_1.Observable.create(function (sub) {
        fs.appendFile(fp, d, {}, function (err) {
            if (err) {
                return sub.error(err);
            }
            sub.next();
            sub.complete();
        });
        return function () {
        };
    });
};
exports.acquireLockRetry = function (q, obj) {
    if (!obj.error) {
        return exports.makeGenericObservable(null, null)
            .map(function () { return obj; });
    }
    return Rx_1.Observable.interval(1500)
        .takeUntil(Rx_1.Observable.race(exports.acquireLock(q, obj.name)
        .filter(function (obj) { return !obj.error; }), Rx_1.Observable.timer(3600)
        .flatMap(function () {
        return Rx_1.Observable.throw('acquire lock timed out');
    })));
};
exports.backpressure = function (q, val, fn) {
    return Rx_1.Observable.create(function (sub) {
        fn.call(sub, function (err, ret) {
            if (err) {
                return sub.error(err);
            }
            sub.next(ret);
            process.nextTick(function () {
                val.cb();
            });
        });
        return function () {
        };
    });
};
exports.readFile$ = function (q) {
    var fp = q.filepath;
    return Rx_1.Observable.create(function (obs) {
        fs.readFile(fp, 'utf8', function (err, data) {
            if (err) {
                return obs.error(err);
            }
            obs.next(data);
            obs.complete();
        });
        return function () {
        };
    });
};
exports.readFile = function (q) {
    var fp = q.filepath;
    return Rx_1.Observable.create(function (obs) {
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
                obs.error({
                    'grep-exit-code': code
                });
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
exports.waitForClientCount = function (q, opts) {
    opts = opts || {};
    var count = opts.count || 10;
    var timeout = opts.timeout || 3000;
    var tries = opts.tries || 5;
    var diff = opts.diff || 5;
    var index = 0;
    return q.clientStream.bufferCount(count)
        .filter(function (value) {
        index++;
        var first = value[0];
        var last = value[value.length - 1];
        if (last.clientCount < 10) {
            return true;
        }
        if (index >= tries) {
            return true;
        }
        if ((first.clientCount - last.clientCount) > diff) {
            return true;
        }
        return false;
    })
        .take(1);
};
exports.acquireLock = function (q, name) {
    var lock = q.lock;
    var client = q.client;
    if (typeof name !== 'string') {
        throw new Error('OPQ implementation error => no name for mutex append.');
    }
    return Rx_1.Observable.create(function (sub) {
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
            console.log(util.inspect({
                acquireLockCount: acquireLockCount,
                releaseLockCount: releaseLockCount
            }));
            sub.next({
                error: err ? (err.stack || err) : undefined,
                id: id,
                name: name
            });
            sub.complete();
        });
        return function () {
        };
    });
};
exports.releaseLock = function (q, lockUuid) {
    var client = q.client;
    if (!lockUuid) {
        console.error('\n\n', new Error('Cannot release lock without force or proper uuid.').stack, '\n\n');
        return Rx_1.Observable.throw('Cannot release lock without force or proper uuid.\n\n');
    }
    if (String(lockUuid).startsWith('<drain')) {
        drainUnlocks++;
        debug('\n\n', 'drain locks/unlocks => ', drainLocks, drainUnlocks, '\n\n');
    }
    return Rx_1.Observable.create(function (sub) {
        var lock = q.lock;
        client.unlock(lock, lockUuid, function (err) {
            if (err) {
                console.error('\n', ' => Release lock error => ', '\n', err.stack || err);
            }
            else {
                releaseLockCount++;
            }
            sub.next({
                error: err ? (err.stack || err) : undefined
            });
            sub.complete();
        });
        return function () {
        };
    });
};

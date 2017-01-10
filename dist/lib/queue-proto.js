'use striiiict';
var util = require('util');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var Rx = require('rxjs');
var _ = require('lodash');
var uuidV4 = require('uuid/v4');
var colors = require('colors/safe');
var debug = require('debug')('cmd-queue');
var EE = require('events');
var Client = require('live-mutex').Client;
var lmUtils = require('live-mutex').utils;
var tail = require('./tail');
var _a = require('./helpers'), acquireLock = _a.acquireLock, releaseLock = _a.releaseLock, genericAppendFile = _a.genericAppendFile, readFile = _a.readFile, makeEEObservable = _a.makeEEObservable, writeFile = _a.writeFile, delayObservable = _a.delayObservable, removeOneLine = _a.removeOneLine, removeMultipleLines = _a.removeMultipleLines, appendFile = _a.appendFile, acquireLockRetry = _a.acquireLockRetry, makeGenericObservable = _a.makeGenericObservable, ifFileExistAndIsAllWhiteSpaceThenTruncate = _a.ifFileExistAndIsAllWhiteSpaceThenTruncate, waitForClientCount = _a.waitForClientCount, findFirstLine = _a.findFirstLine;
var p = {};
p.getLock = function () {
    return this.lock;
};
p.getClient = function () {
    return this.client;
};
p.close = function () {
    this.client && this.client.close();
};
p._enqControlled = function enqControlled(lines, opts) {
    var _this = this;
    opts = opts || {};
    var priority = opts.priority || 1;
    console.log(' \n We are being controlled. \n ');
    var isShare = opts.isShare !== false;
    lines = _.flattenDeep([lines]);
    var $add = this.init()
        .flatMap(function () {
        return waitForClientCount(_this, { timeout: 3000, count: 5 });
    })
        .flatMap(function () {
        return acquireLock(_this, 'enqControlled')
            .flatMap(function (obj) {
            return acquireLockRetry(_this, obj);
        })
            .map(function (obj) {
            return ({ error: obj.error, id: obj.id, opts: opts });
        })
            .flatMap(function (obj) {
            return appendFile(_this, lines, priority)
                .map(function () { return obj; })
                .flatMap(function (obj) { return releaseLock(_this, obj.id); });
        });
    })["catch"](function (err) {
        console.error('\n', ' => add / enqueue error => \n', err.stack || err);
        var force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(_this, force);
    });
    if (isShare) {
        $add = $add.share();
        $add.subscribe();
    }
    return $add;
};
p._deqWait = function (opts) {
    var _this = this;
    var count = opts.count;
    var isConnect = opts.isConnect !== false;
    var pattern = opts.pattern;
    var min = opts.min || count;
    assert(Array.isArray(opts.lines), ' => OPQ Implementation error => opts.lines should be an array');
    var ret = [];
    var obs = new Rx.Subject();
    process.nextTick(function () {
        obs.next();
    });
    var $dequeue = obs
        .flatMap(function () {
        return _this.init();
    })
        .flatMap(function () {
        return acquireLock(_this, 'deqWait')
            .flatMap(function (obj) {
            return acquireLockRetry(_this, obj);
        });
    })
        .flatMap(function (obj) {
        return removeMultipleLines(_this, pattern, count - ret.length)
            .map(function (lines) { return ({ obj: obj, lines: lines }); });
    })
        .flatMap(function (data) {
        var obj = data.obj;
        var lines = data.lines;
        ret = ret.concat(lines).filter(function (i) { return i; });
        var len = ret.length;
        var diff = min - len;
        console.log('diff => ', diff);
        if (diff < 1) {
            $dequeue.complete();
            obs.unsubscribe();
            return releaseLock(_this, obj.id)
                .map(function () { return ({ lines: ret }); });
        }
        else {
            return releaseLock(_this, obj.id)
                .flatMap(function () {
                console.log('diff => ', diff);
                return Rx.Observable.race(Rx.Observable.timer(8500), _this.obsEnqueue.skip(diff).take(1));
            })
                .filter(function () {
                obs.next();
                return false;
            });
        }
    })["catch"](function (e) {
        console.error(e.stack || e);
        var force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(_this, force);
    })
        .take(1);
    if (isConnect) {
        $dequeue = $dequeue.publish();
        $dequeue.connect();
    }
    return $dequeue;
};
module.exports = p;

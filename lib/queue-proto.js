'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var Rx_1 = require("rxjs/Rx");
var _ = require("lodash");
var uuidV4 = require("uuid/v4");
var helpers_1 = require("./helpers");
var QProto = (function () {
    function QProto(obj) {
        this.lock = ['[OPQ]>', uuidV4()].join('');
        this.dateCreated = new Date();
        this.filePath = obj.filePath;
    }
    QProto.prototype.getLock = function () {
        return this.lock;
    };
    QProto.prototype.getClient = function () {
        return this.client;
    };
    QProto.prototype.close = function () {
        this.client && this.client.close();
    };
    QProto.prototype._enqControlled = function (lines, opts) {
        var _this = this;
        opts = opts || {};
        var priority = opts.priority || 1;
        var isShare = opts.isShare !== false;
        lines = _.flattenDeep([lines]);
        var add$ = this.init()
            .flatMap(function () {
            return helpers_1.waitForClientCount(_this, { timeout: 3000, count: 25, tries: 25 });
        })
            .flatMap(function () {
            return helpers_1.acquireLock(_this, '<enqControlled>')
                .flatMap(function (obj) {
                return helpers_1.acquireLockRetry(_this, obj);
            })
                .map(function (obj) { return ({ error: obj.error, id: obj.id, opts: opts }); })
                .flatMap(function (obj) {
                return helpers_1.appendFile(_this, lines, priority)
                    .map(function () { return obj; })
                    .flatMap(function (obj) { return helpers_1.releaseLock(_this, obj.id); });
            });
        })
            .catch(function (err) {
            console.error('add/enqueue error:', err.stack || err);
            var force = !String(err.stack || err).match(/acquire lock timed out/);
            return helpers_1.releaseLock(_this, force);
        })
            .take(1);
        if (isShare) {
            add$ = add$.share();
            add$.subscribe();
        }
        return add$;
    };
    QProto.prototype._deqWait = function (opts) {
        var _this = this;
        var count = opts.count;
        var isConnect = opts.isConnect !== false;
        var pattern = opts.pattern;
        var min = opts.min || count;
        assert(Array.isArray(opts.lines), 'OPQ Implementation error => opts.lines should be an array');
        var ret = [];
        var obs = new Rx_1.Subject();
        process.nextTick(function () {
            obs.next();
        });
        var $dequeue = obs
            .flatMap(function () {
            return _this.init();
        })
            .flatMap(function () {
            return helpers_1.acquireLock(_this, '<deqWait>')
                .flatMap(function (obj) {
                return helpers_1.acquireLockRetry(_this, obj);
            });
        })
            .flatMap(function (obj) {
            return helpers_1.removeMultipleLines(_this, pattern, count - ret.length)
                .map(function (lines) { return ({ obj: obj, lines: lines }); });
        })
            .flatMap(function (data) {
            var obj = data.obj;
            var lines = data.lines;
            ret = ret.concat(lines).filter(function (i) { return i; });
            var len = ret.length;
            var diff = min - len;
            if (diff < 1) {
                $dequeue.complete();
                obs.unsubscribe();
                return helpers_1.releaseLock(_this, obj.id)
                    .map(function () { return ({ lines: ret }); });
            }
            else {
                return helpers_1.releaseLock(_this, obj.id)
                    .flatMap(function () {
                    return Rx_1.Observable.race(Rx_1.Observable.timer(8500), _this.obsEnqueue.skip(diff).take(1));
                })
                    .filter(function () {
                    obs.next();
                    return false;
                });
            }
        })
            .catch(function (e) {
            console.error(e.stack || e);
            var force = !String(e.stack || e).match(/acquire lock timed out/);
            return helpers_1.releaseLock(_this, force);
        })
            .take(1);
        if (isConnect) {
            $dequeue = $dequeue.publish();
            $dequeue.connect();
        }
        return $dequeue;
    };
    return QProto;
}());
exports.QProto = QProto;

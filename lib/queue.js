'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var assert = require("assert");
var Rx = require("rxjs");
var _ = require("lodash");
var colors = require("colors/safe");
var debug = require('debug')('cmd-queue');
var EE = require("events");
var Client = require("live-mutex/client");
var lmUtils = require("live-mutex/utils");
var queue_proto_1 = require("./queue-proto");
var handlePriority = require("./handle-priority");
var startTail = require("./start-tail");
var Rx_1 = require("rxjs/Rx");
var rxjs_1 = require("rxjs");
require('./rxjs-patches');
process.on('warning', function (w) {
    if (!String(w).match(/DEBUG_FD/)) {
        console.error('\n', ' => OPQ warning => ', w.stack || w, '\n');
    }
});
var _a = require('./helpers'), backpressure = _a.backpressure, countLines = _a.countLines, acquireLock = _a.acquireLock, releaseLock = _a.releaseLock, genericAppendFile = _a.genericAppendFile, makeEEObservable = _a.makeEEObservable, removeOneLine = _a.removeOneLine, removeMultipleLines = _a.removeMultipleLines, appendFile = _a.appendFile, acquireLockRetry = _a.acquireLockRetry, makeGenericObservable = _a.makeGenericObservable, ifFileExistAndIsAllWhiteSpaceThenTruncate = _a.ifFileExistAndIsAllWhiteSpaceThenTruncate, findFirstLine = _a.findFirstLine;
var Queue = (function (_super) {
    __extends(Queue, _super);
    function Queue(obj) {
        var _this = _super.call(this, obj) || this;
        assert(typeof obj === 'object', ' => OPQ usage error => Please pass in an options object to the Queue constructor.');
        var fp = _this.fp = _this.filepath = obj.filepath || obj.filePath || obj.fp;
        var port = _this.port = obj.port;
        assert(String(fp).length > 0, ' => Please pass the filepath of the queue.');
        assert(Number.isInteger(port), ' => Please pass in an integer for the port.');
        var lck = _this.lock;
        if (obj.priority) {
            handlePriority(obj, _this);
        }
        _this.isEmptyStream = new rxjs_1.Subject();
        _this.obsDequeue = new rxjs_1.Subject();
        var index = 0;
        var obsEnqueue = _this.obsEnqueue = new rxjs_1.Subject();
        _this.queueStream = Rx_1.Observable.create(function (obs) {
            var push = Rx.Subscriber.create(function (v) {
                if ((index % obsEnqueue.observers.length) === obsEnqueue.observers.indexOf(push)) {
                    obs.next(v);
                }
            });
            return obsEnqueue.subscribe(push);
        });
        var push = function (v) {
            obsEnqueue.next(v);
            index++;
        };
        process.once('exit', function () {
            _this.close();
        });
        _this.isReady = false;
        var callable = true;
        var obsClient = _this.obsClient = new rxjs_1.Subject();
        var clientEE = new EE();
        clientEE.setMaxListeners(200);
        function onClientConnectionChange(clientCount) {
            obsClient.next({
                time: Date.now(),
                clientCount: clientCount
            });
        }
        _this.init = function (isPublish) {
            if (_this.isReady) {
                return makeGenericObservable(null, { isPublish: isPublish });
            }
            if (!callable) {
                return makeEEObservable(_this, clientEE, { isPublish: isPublish });
            }
            callable = false;
            var promise = lmUtils.conditionallyLaunchSocketServer({ port: port });
            return Rx_1.Observable.fromPromise(promise)
                .flatMap(function () {
                _this.client = new Client({ key: lck, port: port, listener: onClientConnectionChange });
                return acquireLock(_this, 'init')
                    .flatMap(function (obj) {
                    return acquireLockRetry(_this, obj);
                });
            })
                .flatMap(function (obj) {
                return genericAppendFile(_this, '')
                    .map(function () { return obj; });
            })
                .flatMap(function (obj) {
                return ifFileExistAndIsAllWhiteSpaceThenTruncate(_this)
                    .map(function () { return obj; });
            })
                .flatMap(function (obj) {
                return releaseLock(_this, obj.id);
            }).do(function () {
                clientEE.emit('ready');
                _this.isReady = true;
                startTail(_this, push);
            })
                .take(1)
                .catch(function (e) {
                console.error(e.stack || e);
                var force = !String(e.stack || e).match(/acquire lock timed out/);
                return releaseLock(_this, force);
            });
        };
        return _this;
    }
    Queue.prototype.eqStream = function (pauser, opts) {
        var _this = this;
        if (!(pauser instanceof Rx.Observable)) {
            opts = pauser || {};
            pauser = new rxjs_1.Subject();
        }
        opts = opts || {};
        var $obs = Rx_1.Observable.zip(this.queueStream, pauser);
        process.nextTick(function () {
            pauser.next();
        });
        return $obs
            .flatMap(function () { return _this.init(); })
            .flatMap(function () {
            return acquireLock(_this, 'eqStream')
                .flatMap(function (obj) {
                return acquireLockRetry(_this, obj);
            });
        })
            .flatMap(function (obj) {
            return removeOneLine(_this, null)
                .map(function (l) { return ({ l: l, id: obj.id }); });
        })
            .flatMap(function (obj) {
            return releaseLock(_this, obj.id)
                .filter(function () { return !!obj.l; })
                .map(function () {
                return {
                    data: obj.l,
                    cb: pauser.next.bind(pauser)
                };
            });
        })
            .catch(function (e) {
            console.error('\n', ' => Error in dequeueStream method => ', '\n', e.stack || e, '\n');
            var force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(_this, force);
        });
    };
    Queue.prototype.readAll = function () {
        return this.obsEnqueue;
    };
    Queue.prototype.isNotEmpty = function (obs) {
        var _this = this;
        if (!obs) {
            obs = new Rx.Subject();
        }
        return obs
            .startWith(0)
            .flatMap(function () {
            return _this.init();
        })
            .flatMap(function () {
            return acquireLock(_this, '<isEmpty>')
                .flatMap(function (obj) {
                return acquireLockRetry(_this, obj);
            });
        })
            .flatMap(function (obj) {
            return findFirstLine(_this)
                .flatMap(function (l) {
                return releaseLock(_this, obj.id)
                    .map(function () {
                    return l;
                });
            });
        })
            .filter(function (l) {
            return !!l;
        })
            .map(function () {
            console.log(colors.yellow(' => Queue is *not* empty.'));
            return { isEmpty: false };
        })
            .catch(function (e) {
            console.error('\n', ' => isEmpty() error => \n', e.stack || e);
            var force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(_this, force);
        })
            .take(1);
    };
    Queue.prototype.isEmpty = function (obs) {
        var _this = this;
        if (!obs) {
            obs = new rxjs_1.Subject();
            process.nextTick(function () {
                obs.next();
            });
        }
        return obs
            .startWith(0)
            .flatMap(function () {
            return _this.init();
        })
            .flatMap(function () {
            return acquireLock(_this, '<isEmpty>')
                .flatMap(function (obj) {
                return acquireLockRetry(_this, obj);
            });
        })
            .flatMap(function (obj) {
            return findFirstLine(_this, null)
                .flatMap(function (l) {
                return releaseLock(_this, obj.id)
                    .map(function () {
                    return l;
                });
            });
        })
            .filter(function (l) {
            return !l;
        })
            .map(function () {
            console.log(colors.yellow(' => Is empty is true.'));
            return { isEmpty: true };
        })
            .catch(function (e) {
            console.error('\n', ' => isEmpty() error => \n', e.stack || e);
            var force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(_this, force);
        })
            .take(1);
    };
    Queue.prototype.drain = function (obs, opts) {
        var _this = this;
        if (!(obs instanceof rxjs_1.Subject)) {
            opts = obs || {};
            obs = new rxjs_1.Subject();
        }
        opts = opts || {};
        assert(typeof opts === 'object' && !Array.isArray(opts), ' => OPQ usage error => opts must be an object.');
        var force = opts.force;
        var backpressure = opts.backpressure === true;
        var isConnect = opts.isConnect === true;
        var delay = opts.delay || 500;
        process.nextTick(function () {
            obs.next();
        });
        var emptyObs = new Rx.Subject();
        var $obs = obs
            .takeUntil(this.isEmpty(emptyObs))
            .flatMap(function () {
            return _this.init();
        })
            .flatMap(function () {
            return acquireLock(_this, '<drain>')
                .flatMap(function (obj) {
                return acquireLockRetry(_this, obj);
            });
        })
            .flatMap(function (obj) {
            return removeOneLine(_this)
                .flatMap(function (l) {
                return releaseLock(_this, obj.id)
                    .map(function () {
                    emptyObs.next();
                    var bound = obs.next.bind(obs);
                    if (backpressure) {
                        return { data: l, cb: bound };
                    }
                    else {
                        process.nextTick(bound);
                        return { data: l };
                    }
                });
            });
        })
            .catch(function (e) {
            console.error('\n', ' => isEmpty() error => \n', e.stack || e);
            var force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(_this, force);
        });
        if (isConnect) {
            $obs = $obs.publish();
            $obs.connect();
        }
        return $obs;
    };
    Queue.prototype.isPriorityQueue = function () {
        return this.priority && this._priority && true;
    };
    Queue.prototype.backpressure = function (val, fn) {
        return backpressure(this, val, fn);
    };
    Queue.prototype.clearQueue = function () {
    };
    Queue.prototype.getSize = function () {
        return countLines(this);
    };
    Queue.prototype.enqueue = function (lines, opts) {
        return this.enq(lines, opts);
    };
    Queue.prototype.enq = function (lines, opts) {
        var _this = this;
        opts = opts || {};
        if (opts.controlled) {
            return this._enqControlled(lines, opts);
        }
        var priority = opts.priority || 1;
        if (opts.priority) {
            assert(typeof this._priority === 'object', ' => You used the priority option to enqueue an item,' +
                ' but this queue was not initialized as a priority queue.');
            var il = this._priority.internalLevels;
            var highestLevel = il[il.length - 1];
            assert(Number.isInteger(priority) && priority >= 1 && priority <= highestLevel, ' => Given the initial settings of this queue, ' +
                'priority option must be an integer, between 1 and ' + highestLevel + ', inclusive.');
        }
        var isShare = opts.isShare === true;
        lines = _.flattenDeep([lines]).map(function (l) {
            return String(l).replace(/[^\x00-\x7F]/g, '');
        });
        var $add = this.init()
            .flatMap(function () {
            return acquireLock(_this, '<enqueue>')
                .flatMap(function (obj) {
                return acquireLockRetry(_this, obj);
            });
        })
            .flatMap(function (obj) {
            return appendFile(_this, lines, priority)
                .map(function () { return obj; });
        })
            .flatMap(function (obj) { return releaseLock(_this, obj.id); })
            .catch(function (err) {
            console.error('\n', ' => add / enqueue error => \n', err.stack || err);
            var force = !String(err.stack || err).match(/acquire lock timed out/);
            return releaseLock(_this, force);
        })
            .take(1);
        if (isShare) {
            $add = $add.share();
            $add.subscribe();
        }
        return $add;
    };
    ;
    Queue.prototype.dequeue = function (opts) {
        return this.deq(opts);
    };
    Queue.prototype.deq = function (opts) {
        var _this = this;
        if (!opts || !opts.lines) {
            opts = Object.assign({
                youngerThan: null,
                olderThan: null,
                min: 0,
                count: 1,
                wait: false,
                pattern: '\\S+'
            }, opts);
            opts.lines = [];
        }
        if (opts.wait) {
            return this._deqWait(opts);
        }
        var isPriority = this.priority ?
            (opts.isPriority !== false) :
            (opts.isPriority === true);
        var count = opts.count;
        var isConnect = opts.isConnect !== false;
        var pattern = opts.pattern;
        var min = opts.min;
        var $dequeue = this.init()
            .flatMap(function () {
            return acquireLock(_this, '<dequeue>')
                .flatMap(function (obj) {
                return acquireLockRetry(_this, obj);
            })
                .map(function (obj) {
                return ({ error: obj.error, id: obj.id, opts: opts });
            });
        })
            .flatMap(function (obj) {
            return removeMultipleLines(_this, pattern, count)
                .map(function (lines) { return ({ lines: lines, id: obj.id }); });
        })
            .flatMap(function (obj) {
            return releaseLock(_this, obj.id)
                .map(function () { return obj.lines; });
        })
            .catch(function (e) {
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
    return Queue;
}(queue_proto_1.QProto));
exports.Queue = Queue;

'use strict';
var assert = require("assert");
var Rx = require("rxjs");
var _ = require("lodash");
var uuidV4 = require("uuid/v4");
var colors = require("colors/safe");
var debug = require('debug')('cmd-queue');
var EE = require("events");
var Client = require("live-mutex/client");
var lmUtils = require("live-mutex/utils");
var qProto = require("./queue-proto");
var handlePriority = require("./handle-priority");
var startTail = require("./start-tail");
require('./rxjs-patches');
process.on('warning', function (w) {
    if (!String(w).match(/DEBUG_FD/)) {
        console.error('\n', ' => OPQ warning => ', w.stack || w, '\n');
    }
});
var start = Date.now();
var _a = require('./helpers'), backpressure = _a.backpressure, countLines = _a.countLines, acquireLock = _a.acquireLock, releaseLock = _a.releaseLock, genericAppendFile = _a.genericAppendFile, readFile = _a.readFile, makeEEObservable = _a.makeEEObservable, writeFile = _a.writeFile, delayObservable = _a.delayObservable, removeOneLine = _a.removeOneLine, removeMultipleLines = _a.removeMultipleLines, appendFile = _a.appendFile, acquireLockRetry = _a.acquireLockRetry, makeGenericObservable = _a.makeGenericObservable, ifFileExistAndIsAllWhiteSpaceThenTruncate = _a.ifFileExistAndIsAllWhiteSpaceThenTruncate, waitForClientCount = _a.waitForClientCount, findFirstLine = _a.findFirstLine;
function Queue(obj) {
    var _this = this;
    assert(typeof obj === 'object', ' => OPQ usage error => Please pass in an options object to the Queue constructor.');
    var fp = this.fp = this.filepath = obj.filepath || obj.filePath || obj.fp;
    var port = this.port = obj.port;
    console.error(colors.red('file fucking path => '), fp);
    assert(String(fp).length > 0, ' => Please pass the filepath of the queue.');
    assert(Number.isInteger(port), ' => Please pass in an integer for the port.');
    var lck = this.lock = ['[OPQ]>', uuidV4()].join('');
    this.dateCreated = new Date();
    if (obj.priority) {
        handlePriority(obj, this);
    }
    this.isEmptyStream = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();
    var index = 0;
    var obsEnqueue = this.obsEnqueue = new Rx.Subject();
    this.queueStream = Rx.Observable.create(function (obs) {
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
    this.isReady = false;
    this.lockUuid = null;
    var callable = true;
    var obsClient = this.obsClient = new Rx.Subject();
    var clientEE = new EE();
    clientEE.setMaxListeners(200);
    function onClientConnectionChange(clientCount) {
        obsClient.next({
            time: Date.now(),
            clientCount: clientCount
        });
    }
    this.init = function (isPublish) {
        if (_this.isReady) {
            return makeGenericObservable(null, { isPublish: isPublish });
        }
        if (!callable) {
            return makeEEObservable(_this, clientEE, { isPublish: isPublish });
        }
        callable = false;
        var promise = lmUtils.conditionallyLaunchSocketServer({ port: port });
        return Rx.Observable.fromPromise(promise)
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
        }).map(function () {
            return startTail(_this, push, clientEE);
        })
            .take(1)
            .catch(function (e) {
            console.error(e.stack || e);
            var force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(_this, force);
        });
    };
}
Queue.prototype = Object.create(qProto);
Queue.prototype.eqStream = function (pauser, opts) {
    var _this = this;
    if (!(pauser instanceof Rx.Observable)) {
        opts = pauser || {};
        pauser = new Rx.Subject();
    }
    opts = opts || {};
    var $obs = Rx.Observable.zip(this.queueStream, pauser);
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
        return removeOneLine(_this)
            .map(function (l) { return ({ l: l, id: obj.id }); });
    })
        .flatMap(function (obj) {
        return releaseLock(_this, obj.id)
            .filter(function () { return obj.l; })
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
        return l;
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
        obs = new Rx.Subject();
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
        return findFirstLine(_this)
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
        obs.isHellaComplete = true;
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
    if (!(obs instanceof Rx.Observable)) {
        opts = obs || {};
        obs = new Rx.Subject();
    }
    opts = opts || {};
    assert(typeof opts === 'object' && !Array.isArray(opts), ' => OPQ usage error => opts must be an object.');
    var backpressure = opts.backpressure === true;
    var isConnect = opts.isConnect === true;
    var delay = opts.delay || 500;
    var force = opts.force;
    process.nextTick(function () {
        obs.next();
    });
    var emptyObs = new Rx.Subject();
    var $obs = obs
        .takeWhile(function () {
        return _this.isNotEmpty();
    })
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
    })
        .takeUntil(this.isEmpty(emptyObs));
    if (isConnect) {
        $obs = $obs.publish();
        $obs.connect();
    }
    return $obs;
};
Queue.prototype.backpressure = function (val, fn) {
    return backpressure(this, val, fn);
};
Queue.prototype.clearQueue = function () {
};
Queue.prototype.getSize = function () {
    return countLines(this);
};
Queue.prototype.enq = Queue.prototype.enqueue = function (lines, opts) {
    var _this = this;
    opts = opts || {};
    if (opts.controlled) {
        return this._enqControlled(lines, opts);
    }
    var priority = opts.priority || 1;
    if (opts.priority) {
        assert(typeof this._priority === 'object', ' => You used the priority option to enqueue an item,' +
            ' but this queue was not initialized with priority data.');
        var il = queue._priority.internalLevels;
        var highestLevel = il[0];
        assert(Number.isInteger(priority), ' => Priority option must be an integer, between 1 and ' + highestLevel + ', inclusive.');
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
Queue.prototype.deq = Queue.prototype.dequeue = function (opts) {
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
module.exports = Queue;

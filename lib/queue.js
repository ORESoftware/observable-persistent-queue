'use strict';
const assert = require("assert");
const Rx = require("rxjs");
const _ = require("lodash");
const uuidV4 = require("uuid/v4");
const colors = require("colors/safe");
const debug = require('debug')('cmd-queue');
const EE = require("events");
const Client = require("live-mutex/client");
const lmUtils = require("live-mutex/utils");
const qProto = require("./queue-proto");
const handlePriority = require("./handle-priority");
const startTail = require("./start-tail");
require('./rxjs-patches');
process.on('warning', function (w) {
    if (!String(w).match(/DEBUG_FD/)) {
        console.error('\n', ' => OPQ warning => ', w.stack || w, '\n');
    }
});
const start = Date.now();
const { backpressure, countLines, acquireLock, releaseLock, genericAppendFile, readFile, makeEEObservable, writeFile, delayObservable, removeOneLine, removeMultipleLines, appendFile, acquireLockRetry, makeGenericObservable, ifFileExistAndIsAllWhiteSpaceThenTruncate, waitForClientCount, findFirstLine } = require('./helpers');
function Queue(obj) {
    assert(typeof obj === 'object', ' => OPQ usage error => Please pass in an options object to the Queue constructor.');
    const fp = this.fp = this.filepath = obj.filepath || obj.filePath || obj.fp;
    const port = this.port = obj.port;
    assert(String(fp).length > 0, ' => Please pass the filepath of the queue.');
    assert(Number.isInteger(port), ' => Please pass in an integer for the port.');
    const lck = this.lock = ['[OPQ]>', uuidV4()].join('');
    this.dateCreated = new Date();
    if (obj.priority) {
        handlePriority(obj, this);
    }
    this.isEmptyStream = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();
    let index = 0;
    let obsEnqueue = this.obsEnqueue = new Rx.Subject();
    this.queueStream = Rx.Observable.create(obs => {
        const push = Rx.Subscriber.create(v => {
            if ((index % obsEnqueue.observers.length) === obsEnqueue.observers.indexOf(push)) {
                obs.next(v);
            }
        });
        return obsEnqueue.subscribe(push);
    });
    const push = v => {
        obsEnqueue.next(v);
        index++;
    };
    process.once('exit', () => {
        this.close();
    });
    this.isReady = false;
    this.lockUuid = null;
    let callable = true;
    let obsClient = this.obsClient = new Rx.Subject();
    const clientEE = new EE();
    clientEE.setMaxListeners(200);
    function onClientConnectionChange(clientCount) {
        obsClient.next({
            time: Date.now(),
            clientCount: clientCount
        });
    }
    this.init = (isPublish) => {
        if (this.isReady) {
            return makeGenericObservable(null, { isPublish: isPublish });
        }
        if (!callable) {
            return makeEEObservable(this, clientEE, { isPublish: isPublish });
        }
        callable = false;
        const promise = lmUtils.conditionallyLaunchSocketServer({ port: port });
        return Rx.Observable.fromPromise(promise)
            .flatMap(() => {
            this.client = new Client({ key: lck, port: port, listener: onClientConnectionChange });
            return acquireLock(this, 'init')
                .flatMap(obj => {
                return acquireLockRetry(this, obj);
            });
        })
            .flatMap(obj => {
            return genericAppendFile(this, '')
                .map(() => obj);
        })
            .flatMap(obj => {
            return ifFileExistAndIsAllWhiteSpaceThenTruncate(this)
                .map(() => obj);
        })
            .flatMap((obj) => {
            return releaseLock(this, obj.id);
        }).map(() => {
            return startTail(this, push, clientEE);
        })
            .take(1)
            .catch(e => {
            console.error(e.stack || e);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });
    };
}
Queue.prototype = Object.create(qProto);
Queue.prototype.eqStream = function (pauser, opts) {
    if (!(pauser instanceof Rx.Observable)) {
        opts = pauser || {};
        pauser = new Rx.Subject();
    }
    opts = opts || {};
    let $obs = Rx.Observable.zip(this.queueStream, pauser);
    process.nextTick(function () {
        pauser.next();
    });
    return $obs
        .flatMap(() => this.init())
        .flatMap(() => {
        return acquireLock(this, 'eqStream')
            .flatMap(obj => {
            return acquireLockRetry(this, obj);
        });
    })
        .flatMap((obj) => {
        return removeOneLine(this)
            .map(l => ({ l: l, id: obj.id }));
    })
        .flatMap((obj) => {
        return releaseLock(this, obj.id)
            .filter(() => obj.l)
            .map(() => {
            return {
                data: obj.l,
                cb: pauser.next.bind(pauser)
            };
        });
    })
        .catch(e => {
        console.error('\n', ' => Error in dequeueStream method => ', '\n', e.stack || e, '\n');
        const force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(this, force);
    });
};
Queue.prototype.readAll = function () {
    return this.obsEnqueue;
};
Queue.prototype.isNotEmpty = function (obs) {
    if (!obs) {
        obs = new Rx.Subject();
    }
    return obs
        .startWith(0)
        .flatMap(() => {
        return this.init();
    })
        .flatMap(() => {
        return acquireLock(this, '<isEmpty>')
            .flatMap(obj => {
            return acquireLockRetry(this, obj);
        });
    })
        .flatMap(obj => {
        return findFirstLine(this)
            .flatMap(l => {
            return releaseLock(this, obj.id)
                .map(() => {
                return l;
            });
        });
    })
        .filter(l => {
        return l;
    })
        .map(() => {
        console.log(colors.yellow(' => Queue is *not* empty.'));
        return { isEmpty: false };
    })
        .catch(e => {
        console.error('\n', ' => isEmpty() error => \n', e.stack || e);
        const force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(this, force);
    })
        .take(1);
};
Queue.prototype.isEmpty = function (obs) {
    if (!obs) {
        obs = new Rx.Subject();
        process.nextTick(function () {
            obs.next();
        });
    }
    return obs
        .startWith(0)
        .flatMap(() => {
        return this.init();
    })
        .flatMap(() => {
        return acquireLock(this, '<isEmpty>')
            .flatMap(obj => {
            return acquireLockRetry(this, obj);
        });
    })
        .flatMap(obj => {
        return findFirstLine(this)
            .flatMap(l => {
            return releaseLock(this, obj.id)
                .map(() => {
                return l;
            });
        });
    })
        .filter(l => {
        return !l;
    })
        .map(() => {
        console.log(colors.yellow(' => Is empty is true.'));
        obs.isHellaComplete = true;
        return { isEmpty: true };
    })
        .catch(e => {
        console.error('\n', ' => isEmpty() error => \n', e.stack || e);
        const force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(this, force);
    })
        .take(1);
};
Queue.prototype.drain = function (obs, opts) {
    if (!(obs instanceof Rx.Observable)) {
        opts = obs || {};
        obs = new Rx.Subject();
    }
    opts = opts || {};
    assert(typeof opts === 'object' && !Array.isArray(opts), ' => OPQ usage error => opts must be an object.');
    const backpressure = opts.backpressure === true;
    const isConnect = opts.isConnect === true;
    const delay = opts.delay || 500;
    const force = opts.force;
    process.nextTick(function () {
        obs.next();
    });
    const emptyObs = new Rx.Subject();
    let $obs = obs
        .takeWhile(() => {
        return this.isNotEmpty();
    })
        .flatMap(() => {
        return this.init();
    })
        .flatMap(() => {
        return acquireLock(this, '<drain>')
            .flatMap(obj => {
            return acquireLockRetry(this, obj);
        });
    })
        .flatMap(obj => {
        return removeOneLine(this)
            .flatMap(l => {
            return releaseLock(this, obj.id)
                .map(() => {
                emptyObs.next();
                const bound = obs.next.bind(obs);
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
        .catch(e => {
        console.error('\n', ' => isEmpty() error => \n', e.stack || e);
        const force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(this, force);
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
    opts = opts || {};
    if (opts.controlled) {
        return this._enqControlled(lines, opts);
    }
    const priority = opts.priority || 1;
    if (opts.priority) {
        assert(typeof this._priority === 'object', ' => You used the priority option to enqueue an item,' +
            ' but this queue was not initialized with priority data.');
        let il = this._priority.internalLevels;
        const highestLevel = il[0];
        assert(Number.isInteger(priority), ' => Priority option must be an integer, between 1 and ' + highestLevel + ', inclusive.');
    }
    const isShare = opts.isShare === true;
    lines = _.flattenDeep([lines]).map(function (l) {
        return String(l).replace(/[^\x00-\x7F]/g, '');
    });
    let $add = this.init()
        .flatMap(() => {
        return acquireLock(this, '<enqueue>')
            .flatMap(obj => {
            return acquireLockRetry(this, obj);
        });
    })
        .flatMap(obj => {
        return appendFile(this, lines, priority)
            .map(() => obj);
    })
        .flatMap(obj => releaseLock(this, obj.id))
        .catch(err => {
        console.error('\n', ' => add / enqueue error => \n', err.stack || err);
        const force = !String(err.stack || err).match(/acquire lock timed out/);
        return releaseLock(this, force);
    })
        .take(1);
    if (isShare) {
        $add = $add.share();
        $add.subscribe();
    }
    return $add;
};
Queue.prototype.deq = Queue.prototype.dequeue = function (opts) {
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
    const isPriority = this.priority ?
        (opts.isPriority !== false) :
        (opts.isPriority === true);
    const count = opts.count;
    const isConnect = opts.isConnect !== false;
    const pattern = opts.pattern;
    const min = opts.min;
    let $dequeue = this.init()
        .flatMap(() => {
        return acquireLock(this, '<dequeue>')
            .flatMap(obj => {
            return acquireLockRetry(this, obj);
        })
            .map(obj => ({ error: obj.error, id: obj.id, opts: opts }));
    })
        .flatMap(obj => {
        return removeMultipleLines(this, pattern, count)
            .map(lines => ({ lines: lines, id: obj.id }));
    })
        .flatMap(obj => {
        return releaseLock(this, obj.id)
            .map(() => obj.lines);
    })
        .catch(e => {
        console.error(e.stack || e);
        const force = !String(e.stack || e).match(/acquire lock timed out/);
        return releaseLock(this, force);
    })
        .take(1);
    if (isConnect) {
        $dequeue = $dequeue.publish();
        $dequeue.connect();
    }
    return $dequeue;
};
module.exports = Queue;

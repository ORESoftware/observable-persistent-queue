'use strict';
const assert = require("assert");
const Rx = require("rxjs");
const _ = require("lodash");
const debug = require('debug')('cmd-queue');
const { acquireLock, releaseLock, removeMultipleLines, appendFile, acquireLockRetry, waitForClientCount } = require('./helpers');
class QProto {
    getLock() {
        return this.lock;
    }
    getClient() {
        return this.client;
    }
    close() {
        this.client && this.client.close();
    }
    _enqControlled(lines, opts) {
        opts = opts || {};
        const priority = opts.priority || 1;
        console.log(' \n We are being controlled. \n ');
        const isShare = opts.isShare !== false;
        lines = _.flattenDeep([lines]);
        let $add = this.init()
            .flatMap(() => {
            return waitForClientCount(this, { timeout: 3000, count: 5 });
        })
            .flatMap(() => {
            return acquireLock(this, 'enqControlled')
                .flatMap(obj => {
                return acquireLockRetry(this, obj);
            })
                .map(obj => ({ error: obj.error, id: obj.id, opts: opts }))
                .flatMap(obj => {
                return appendFile(this, lines, priority)
                    .map(() => obj)
                    .flatMap(obj => releaseLock(this, obj.id));
            });
        })
            .catch(err => {
            console.error('\n', ' => add / enqueue error => \n', err.stack || err);
            const force = !String(err.stack || err).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });
        if (isShare) {
            $add = $add.share();
            $add.subscribe();
        }
        return $add;
    }
    _deqWait(opts) {
        const count = opts.count;
        const isConnect = opts.isConnect !== false;
        const pattern = opts.pattern;
        const min = opts.min || count;
        assert(Array.isArray(opts.lines), ' => OPQ Implementation error => opts.lines should be an array');
        let ret = [];
        const obs = new Rx.Subject();
        process.nextTick(function () {
            obs.next();
        });
        let $dequeue = obs
            .flatMap(() => {
            return this.init();
        })
            .flatMap(() => {
            return acquireLock(this, 'deqWait')
                .flatMap(obj => {
                return acquireLockRetry(this, obj);
            });
        })
            .flatMap(obj => {
            return removeMultipleLines(this, pattern, count - ret.length)
                .map(lines => ({ obj: obj, lines: lines }));
        })
            .flatMap((data) => {
            const obj = data.obj;
            const lines = data.lines;
            ret = ret.concat(lines).filter(i => i);
            const len = ret.length;
            const diff = min - len;
            console.log('diff => ', diff);
            if (diff < 1) {
                $dequeue.complete();
                obs.unsubscribe();
                return releaseLock(this, obj.id)
                    .map(() => ({ lines: ret }));
            }
            else {
                return releaseLock(this, obj.id)
                    .flatMap(() => {
                    console.log('diff => ', diff);
                    return Rx.Observable.race(Rx.Observable.timer(8500), this.obsEnqueue.skip(diff).take(1));
                })
                    .filter(() => {
                    obs.next();
                    return false;
                });
            }
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
    }
}
exports.QProto = QProto;

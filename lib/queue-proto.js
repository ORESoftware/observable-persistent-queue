'use striiiict';

//core
const util = require('util');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

//npm
const Rx = require('rxjs');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

//project
const debug = require('debug')('cmd-queue');
const EE = require('events');
const Client = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');
const tail = require('./tail');

const {

    acquireLock,
    releaseLock,
    genericAppendFile,
    readFile,
    makeEEObservable,
    writeFile,
    delayObservable,
    removeOneLine,
    removeMultipleLines,
    appendFile,
    acquireLockRetry,
    makeGenericObservable,
    ifFileExistAndIsAllWhiteSpaceThenTruncate,
    waitForClientCount,
    findFirstLine

} = require('./helpers');


const p = {};

p._enqControlled = function (lines, opts) {

    opts = opts || {};

    const priority = opts.priority || 1;

    console.log(' \n We are being controlled. \n ');
    const isShare = opts.isShare !== false;

    lines = _.flattenDeep([lines]);

    let $add = this.init()
        .flatMap(() => {
            return waitForClientCount(this, {timeout: 3000, count: 5})
        })
        .flatMap(() => {
            return acquireLock(this)
                .flatMap(obj => {
                    return acquireLockRetry(this, obj)
                })
                .map(obj =>
                    ({error: obj.error, id: obj.id, opts: opts}))
                .flatMap(obj => {
                    return appendFile(this, lines, priority)
                        .map(() => obj)
                        .flatMap(obj => releaseLock(this, obj.id))
                });
        })
        .catch(err => {
            console.error('\n', ' => add / enqueue error => \n', err.stack || err);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        });

    if (isShare) {
        $add = $add.share();
        $add.subscribe();
    }

    return $add;

};

p._deqWait = function (opts) {

    const count = opts.count;
    const isConnect = opts.isConnect !== false;
    const pattern = opts.pattern;
    const min = opts.min || count;

    assert(Array.isArray(opts.lines),
        ' => OPQ Implementation error => opts.lines should be an array');

    // store the lines here which we will eventually send back
    let ret = [];

    const obs = new Rx.Subject();

    process.nextTick(function () {
        // this will kick-off the below observable chain
        obs.next();
    });

    let $dequeue = obs
        .flatMap(() => {
            return this.init();
        })
        .flatMap(() => {
            return acquireLock(this)
                .flatMap(obj => {
                    return acquireLockRetry(this, obj)
                });
        })
        .flatMap(obj => {
            return removeMultipleLines(this, pattern, count - ret.length)
                .map(lines => ({obj: obj, lines: lines}))
        })
        .flatMap(data => {

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
                    .map(() => ({lines: ret}))
            }
            else {
                return releaseLock(this, obj.id)
                    .flatMap(() => {
                        console.log('diff => ', diff);
                        return Rx.Observable.race(
                            Rx.Observable.timer(8500),
                            // we only want to re-invoke this chain after more items have been added to the queue
                            // otherwise there would be no point
                            // however, after 8+ seconds, we might as well retry just in case?
                            this.obsEnqueue.skip(diff).take(1)
                        )
                    })
                    .filter(() => {
                        obs.next();
                        // explicit for your pleasure
                        // since we did not get enough results, we must wait and retry for more
                        // we retry by fire obs.next() above, which re-calls this whole chain
                        // this avoids real recursion for much safer and simpler stuff
                        return false;
                    });
            }
        })
        .catch(e => {
            console.error(e.stack || e);
            const force = !String(e.stack || e).match(/acquire lock timed out/);
            return releaseLock(this, force);
        })
        // only take one, then we are done and should fire onComplete()
        .take(1);

    if (isConnect) {
        // this is necessary, if the user does not call subscribe,
        // if the user does not want to auto-subscribe, they will have to pass in isConnect=false.
        $dequeue = $dequeue.publish();
        $dequeue.connect();
    }

    return $dequeue;

};

module.exports = p;
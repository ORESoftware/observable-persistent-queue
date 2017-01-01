'use strict';


//core
const util = require('util');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const cp = require('child_process');

//npm
const Rx = require('rxjs');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

//project
const sed = require('./sed');
const head = require('./head');
const debug = require('debug')('cmd-queue');

/////////////////////////////////////////////////////////////////////////////////////////////

const start = Date.now();
var releaseLockCount = 0;
var acquireLockCount = 0;
var count = 0;

/////////////////////////////////////////////////////////////////////////////////////////////

// TODO: http://askubuntu.com/questions/509881/tail-reading-an-entire-file-and-then-following

/////////////////////////////////////////////////////////////////////////////////////////////


exports.makeEEObservable = function _makeEEObservable(ee, opts) {

    opts = opts || {};
    const isCallCompleted = opts.isCallCompleted;
    const isPublish = opts.isPublish;

    let obs = Rx.Observable.create(obs => {
        ee.once('error', function (err) {
            obs.error(err)
        });
        ee.once('ready', function () {
            obs.next();
            if (isCallCompleted) {
                obs.complete();
            }
        });
    });

    if (isPublish) {
        obs = obs.publish().refCount();
    }
    return obs;
};


const makeGenericObservable = exports.makeGenericObservable = function _makeGenericObservable(fn, opts) {

    opts = opts || {};
    const isCallCompleted = opts.isCallCompleted;
    const isPublish = opts.isPublish;

    let obs = Rx.Observable.create(obs => {
        if (fn) {
            fn(function (err, val) {
                if (err) {
                    obs.error(err);
                }
                else {
                    obs.next(val);
                    if (iscompleted) {
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


exports.findFirstLine = function _findFirstLine(queue, pattern){
    pattern = pattern || '\\S+';

    const count = 1;
    const choice = 'find-one';

    return sed(queue, pattern, count, choice)
        .map(data => {

            // split by newline and filter out empty lines
            const lines = String(data).split('\n')
                .filter(l => String(l).trim().length > 0)
                .map(l => String(l).trim());

            var l = lines.shift();

            if (!l) {
                console.log('\n', colors.bgMagenta(' => Warning no line returned.'));
                return undefined;
            }

            var parsed;

            try {
                parsed = JSON.parse(l);
            }
            catch (err) {
                console.error(colors.red(' => JSON.parse error =>'), '\n' + err.stack);
                console.error(' => Line could not be parsed => ' + l);
                return undefined;
            }

            debug(' => Line that was parsed => ', parsed);
            return parsed;
        });

};


exports.removeOneLine = function _removeOneLine(queue, pattern) {

    pattern = pattern || '\\S+';

    const count = 1;
    const choice = 'single';

    return sed(queue, pattern, count, choice)
        .map(data => {

            // split by newline and filter out empty lines
            const lines = String(data).split('\n')
                .filter(l => String(l).trim().length > 0)
                .map(l => String(l).trim());

            var l = lines.shift();

            if (!l) {
                console.log('\n', colors.bgMagenta(' => Warning no line returned.'));
                return undefined;
            }

            var parsed;

            try {
                parsed = JSON.parse(l);
            }
            catch (err) {
                console.error(colors.red(' => JSON.parse error =>'), '\n' + err.stack);
                console.error(' => Line could not be parsed => ' + l);
                return undefined;
            }

            debug(' => Line that was parsed => ', parsed);
            return parsed;
        });

};


exports.removeMultipleLines = function _removeMultipleLines(queue, pattern, count) {

    const choice = 'multiple';

    return sed(queue, pattern, count, choice)
        .map(data => {

            // split by newline and filter out empty lines
            const lines = String(data).split('\n')
                .filter(l => String(l).trim().length > 0)
                .map(l => {
                    try {
                        return JSON.parse(String(l).trim());
                    }
                    catch (err) {
                        return '';
                    }
                })
                .filter(i => i);


            if (lines.length < 1) {
                console.log('\n', colors.bgMagenta(' => Warning no line returned.'));
            }

            return lines;
        });

};

const writeFile = exports.writeFile = function _writeFile(queue, data) {

    const filePath = queue.filepath;
    data = data || '';

    return Rx.Observable.create(obs => {
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
            // console.log('disposing appendFile()');
        }
    });

};


exports.appendFile = function _appendFile(queue, lines, priority) {

    const filePath = queue.filepath;

    assert(Number.isInteger(priority), ' => Implementation error => "priority" must be an integer.');

    //ensure new line separation
    lines = lines.map(function (l) {

        assert.equal(typeof l,'string');
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

    const data = lines.join('\n') + '\n';

    return Rx.Observable.create(obs => {
        fs.appendFile(filePath, data, err => {
            if (err) {
                obs.error(err);
            }
            else {
                obs.next(lines);
                obs.complete();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
    });

};

exports.delayObservable = function (delay, isCompleted) {
    return Rx.Observable.create(obs => {
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
        .flatMap(data => {
            if (data) {
                return makeGenericObservable();
            }
            else {
                // if not data, then we truncate file
                return writeFile(queue);
            }
        });

};

exports.obviousObservable = function _obviousObservable() {

    return Rx.Observable.create(obs => {
        process.nextTick(function () {
            obs.next();
        });
    });

};


exports.genericAppendFile = function _genericAppendFile(queue, data) {

    const d = data || '';
    const fp = queue.filepath;

    return Rx.Observable.create(obs => {
        // try to open file for reading and writing
        // fs.writeFile(fp, d, {flag: 'w+'}, err => {
        fs.appendFile(fp, d, {}, err => {
            if (err) {
                console.log('error => ', err.stack);
                obs.error(err);
            }
            else {
                obs.next();
                obs.complete();
            }
        });

        return function () {
            // console.log('disposing genericAppendFile()');
        }
    });

};

exports.acquireLockRetry = function _acquireLockRetry(obj) {

    if (!obj.error) {
        return makeGenericObservable()
            .map(() => obj);
    }

    console.log(' => need to retry acquiring lock.');

    return Rx.Observable.interval(500)
        .takeUntil(
            // take until either the timeout occurs or we actually acquire the lock
            Rx.Observable.race(

                acquireLock(this)
                    .filter(obj => !obj.error),

                Rx.Observable.timer(2600)
                    .flatMap(() => {
                        return Rx.Observable.throw('acquire lock timed out')
                    })

            )
        )


};


const acquireLock = exports.acquireLock = function _acquireLock(queue) {

    const lock = queue.lock;
    const client = queue.client;

    return Rx.Observable.create(obs => {

        client.lock(lock, function (err, unlock, id) {
            if (err) {
                console.error(' => Error acquiring LOCK => ', err.stack || err);
            }
            else {
                acquireLockCount++;
            }

            debug(util.inspect({
                acquireLockCount: acquireLockCount,
                releaseLockCount: releaseLockCount
            }));

            obs.next({
                error: err ? (err.stack || err) : undefined,
                id: id
            });
            obs.complete();

        });

        return function () {
            // console.log('disposing acquireLock()');
        }
    });
};


const readFile$ = exports.readFile$ = function _readFile(queue) {

    const fp = queue.filepath;

    return Rx.Observable.create(obs => {
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
            // console.log('disposing readFile()');
        }
    });
};


const readFile = exports.readFile = function (queue) {

    const fp = queue.filepath;

    return Rx.Observable.create(obs => {

        const n = cp.spawn('grep', ['-m', '1', '-E', '\\S+', fp]);

        var data = '';
        n.stdout.setEncoding('utf8');

        n.stdout.on('data', d => {
            data += String(d);
        });

        n.stderr.on('data', function (d) {
            console.error(colors.bgRed(' => grep error => '), d);
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

                console.log('\n', colors.blue(' => data is as data do => '), '\n', data);
                obs.next(data);
                obs.complete();

            }

        });

        return function () {

        }

    });

};


exports.waitForClientCount = function _waitForClientCount(queue, opts) {

    opts = opts || {};
    const count = opts.count || 5;
    const timeout = opts.timeout || 3000;

    const index = opts.index;

    return queue.obsClient.bufferCount(count)
        .flatMap(value => {

            const first = value.shift();
            const last = value[value.length - 1];

            if (opts.index > 3 || (last.clientCount - first.clientCount < 2)) {
                return Rx.Observable.timer(10)
            }
            else {
                opts.index = opts.index || 0;
                opts.index++;
                return _waitForClientCount.apply(null, [queue,opts]);
            }

        });
};


exports.releaseLock = function _releaseLock(queue, lockUuid) {

    const client = queue.client;

    if (!lockUuid) {

        console.error(new Error('FML').stack);
        throw new Error('fuck it');
    }

    return Rx.Observable.create(obs => {

        const lock = queue.lock;

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
            // console.log('disposing releaseLock()');
        }
    });
};

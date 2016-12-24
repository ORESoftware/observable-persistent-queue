'use strict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

const Broker = require('live-mutex/broker');
const Client = require('live-mutex/client');
const b = new Broker();
const client = new Client();

/////////////////////////////////////////////////////////////////////////////////////////////

const start = Date.now();
var releaseLockCount = 0;
var acquireLockCount = 0;
var count = 0;

/////////////////////////////////////////////////////////////////////////////////////////////


exports.makeGenericObservable = function _makeGenericObservable(fn) {
    return Rx.Observable.create(obs => {
        if (!fn) {
            return process.nextTick(function () {
                obs.onNext();
                obs.onCompleted();
            });
        }
        fn(function (err, val) {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext(val);
                obs.onCompleted();
            }
        });
    });
};

exports.removeOneLine = function _removeOneLine(queue) {

    return readFile(queue)
        .flatMap(data => {

            // split by newline and filter out empty lines
            const lines = String(data).split('\n').filter(l => String(l).trim().length);

            var l = lines.shift();

            if (!l) {
                return Rx.Observable.create(obs => {
                    obs.onNext();
                });
            }

            l = l.trim();
            const d = '\n' + lines.join('\n') + '\n';

            return writeFile(queue, d)   //return line that got shifted off queue
                .flatMap(() => {
                    return Rx.Observable.create(obs => {
                        console.log('line popped from file => ', l);
                        obs.onNext(l);
                    })
                });

        });
};



const writeFile = exports.writeFile = function _writeFile(queue, data) {

    const filePath = queue.filepath;

    return Rx.Observable.create(obs => {
        fs.writeFile(filePath, data, err => {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
    });

};


exports.appendFile = function _appendFile(queue, lines) {

    const filePath = queue.filepath;

    //ensure new line separation
    lines = lines.map(function (l) {
        return JSON.stringify({
            pid: process.pid,
            count: count++,
            line: l,
            uid: uuidV4(),
            isRead: false
        });
    });

    const data = lines.join('\n') + '\n';

    return Rx.Observable.create(obs => {
        fs.appendFile(filePath, data, err => {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext(lines);
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing appendFile()');
        }
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
                obs.onError(err);
            }
            else {
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing genericAppendFile()');
        }
    });

};


exports.acquireLock = function _acquireLock(queue) {

    const lock = queue.lock;

    return Rx.Observable.create(obs => {

        client.lock(lock).then(
            function () {
                console.log(util.inspect({
                    acquireLockCount: acquireLockCount,
                    releaseLockCount: releaseLockCount
                }));
                acquireLockCount++;
                obs.onNext();
                obs.onCompleted();
            },
            obs.onError);

        return function () {
            // console.log('disposing acquireLock()');
        }
    });
};


const readFile = exports.readFile = function _readFile(queue) {

    const fp = queue.filepath;

    return Rx.Observable.create(obs => {
        fs.readFile(fp, 'utf8', function (err, data) {
            if (err) {
                console.log('errrror => ', err.stack);
                obs.onError(err);
            }
            else {
                obs.onNext(data);
                obs.onCompleted();
            }

        });
        return function () {
            // console.log('disposing readFile()');
        }
    });
};


exports.releaseLock = function _releaseLock(queue) {

    return Rx.Observable.create(obs => {

        const lock = queue.lock;

        client.unlock(lock).then(
            function () {
                releaseLockCount++;
                obs.onNext();
                obs.onCompleted();
            },
            obs.onError);

        return function () {
            // console.log('disposing releaseLock()');
        }
    });
};

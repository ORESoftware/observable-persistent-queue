'use strict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');
const sed = require('./sed');
const head = require('./head');
const cp = require('child_process');
const debug = require('debug')('cmd-queue');

/////////////////////////////////////////////////////////////////////////////////////////////

const start = Date.now();
var releaseLockCount = 0;
var acquireLockCount = 0;
var count = 0;


///////////////////////////////////////////////

// TODO: http://askubuntu.com/questions/509881/tail-reading-an-entire-file-and-then-following

/////////////////////////////////////////////////////////////////////////////////////////////


exports.makeEEObservable = function _makeEEObservable(ee, opts) {

    opts = opts || {};
    const isCallOnCompleted = opts.isCallOnCompleted;
    const isPublish = opts.isPublish;

    let obs = Rx.Observable.create(obs => {
        ee.once('error', function (err) {
            obs.onError(err)
        });
        ee.once('ready', function () {
            obs.onNext();
            if (isCallOnCompleted) {
                obs.onCompleted();
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
    const isCallOnCompleted = opts.isCallOnCompleted;
    const isPublish = opts.isPublish;

    let obs = Rx.Observable.create(obs => {
        if (!fn) {
            return process.nextTick(function () {
                obs.onNext();
                if (isCallOnCompleted) {
                    obs.onCompleted();
                }
            });
        }
        fn(function (err, val) {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext(val);
                if (isCallOnCompleted) {
                    obs.onCompleted();
                }

            }
        });
    });

    if (isPublish) {
        obs = obs.publish().refCount();
    }
    return obs;
};

exports.removeOneLine_old = function _removeOneLine(queue) {

    return readFile(queue)

        .flatMap(data => {

            // split by newline and filter out empty lines
            const lines = String(data).split('\n')
                .filter(l => String(l).trim().length > 0)
                .map(l => String(l).trim());

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
                        if (l) {
                            console.log('\n', colors.cyan(' => line popped from file => '), l);
                        }
                        obs.onNext(l);
                    })
                });

        });
};

exports.removeOneLine = function _removeOneLine(queue) {

    return sed(queue, '\\S+')
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
                throw(' => Line could not be parsed => ' + l);
            }

            console.log(' => Line that was parsed => ', parsed);
            return parsed;
        });

};

exports.removeOneLine_sed = function _removeOneLine_sed(queue) {

    return readFile(queue)
        .flatMap(data => {

            // split by newline and filter out empty lines
            const lines = String(data).split('\n')
                .filter(l => String(l).trim().length > 0)
                .map(l => String(l).trim());

            var l = lines.shift();

            if (!l) {
                return Rx.Observable.create(obs => {
                    obs.onNext();
                });
            }

            var parsed;

            try {
                parsed = JSON.parse(l);
            }
            catch (err) {
                console.error(' => JSON.parse error => \n' + err.stack);
                return Rx.Observable.throw(' => Line could not be parsed => ' + l);
            }

            return sed(queue, parsed.uid)
                .flatMap(() => {
                    return Rx.Observable.create(obs => {
                        if (l) {
                            console.log('\n', colors.magenta(' => line popped from file => '), l);
                        }
                        obs.onNext(l);
                    })
                });

        });
};


const writeFile = exports.writeFile = function _writeFile(queue, data) {

    const filePath = queue.filepath;
    data = data || '';

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
            dateCreated: new Date().toISOString(),
            pid: process.pid,
            count: count++,
            uid: uuidV4(),
            isRead: false,
            line: l
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
    const client = queue.client;

    return Rx.Observable.create(obs => {

        client.lock(lock, function (err) {
            if (err) {
                obs.onError(err);
            }
            else {
                debug(util.inspect({
                    acquireLockCount: acquireLockCount,
                    releaseLockCount: releaseLockCount
                }));
                acquireLockCount++;
                obs.onNext();
                obs.onCompleted();
            }
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


const readFile = exports.readFile = function (queue) {

    const fp = queue.filepath;

    return Rx.Observable.create(obs => {

        //grep -m 1 -E "\S+" /path/to/file

        const n = cp.spawn('grep', ['-m', '1', '-E', '\\S+', fp]);

        // cp.exec("grep -m 1 -E '\\S+' " + fp, function (err, stdout, stderr) {
        //     if (err) {
        //         console.error(' => grep error => ', err.stack || err);
        //         obs.onError(err);
        //     }
        //     else if (stderr) {
        //         console.error(colors.red(' => stderr from grep =>') + '"' + stderr + '"');
        //         obs.onNext({
        //             error: stderr
        //         });
        //     }
        //     else {
        //         console.log('\n', colors.blue(' => data is as data do => '), '\n', stdout);
        //         obs.onNext(stdout);
        //         obs.onCompleted();
        //     }
        //
        // });

        var data = '';

        n.stdout.setEncoding('utf8');

        n.stdout.on('data', d => {
            data += String(d);
        });

        n.stderr.on('data', function (d) {
            console.error(colors.bgRed(' => grep error => '), d);
        });

        n.on('close', function (code) {

            if (code > 1) {
                console.error(colors.red(' => grep exit code is greater than 0 => '), code, ' => stdout => ', '"' + data + '"');
                obs.onError({
                    'grep-exit-code': code
                });
            }
            else {

                console.log('\n', colors.blue(' => data is as data do => '), '\n', data);
                obs.onNext(data);
                obs.onCompleted();

            }

        });

    });

};


exports.releaseLock = function _releaseLock(queue) {

    const client = queue.client;

    return Rx.Observable.create(obs => {

        const lock = queue.lock;

        client.unlock(lock, true, function (err) {
            if (err) {
                obs.onError(err);
            }
            else {
                releaseLockCount++;
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            // console.log('disposing releaseLock()');
        }
    });
};

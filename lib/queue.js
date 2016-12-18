const util = require('util');
const fs = require('fs');
const path = require('path');
const lockFile = require('lockfile');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');


function appendFile(queue, lines) {

    const filePath = queue.filepath;

    //ensure new line separation
    lines = lines.map(function (l) {
        return JSON.stringify({
            line: l,
            uid: uuidV4(),
            isRead: false
        });
    });

    const data = '\n' + lines + '\n';

    return Rx.Observable.create(obs => {
        fs.appendFile(filePath, data, (err, result) => {
            if (err) {
                obs.onError(err);
            }
            else {
                if (result) {
                    console.log('result of fs.appendFile => ', result);
                }
                obs.onNext(lines);
                obs.onCompleted();
            }
        });

        return function () {
            console.log('disposing appendFile()');
        }
    });

}


function writeFile(queue, data) {

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
            console.log('disposing writeFile()');
        }
    });

}

function acquireLock(queue) {

    const lock = queue.lock;

    return Rx.Observable.create(obs => {
        lockFile.lock(lock, function (err) {
            if (err) {
                obs.onError(err);
            }
            else {
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            console.log('disposing getLock()');
        }
    });
}


function readFile(queue) {

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
            console.log('disposing readFile()');
        }
    });
}


function releaseLock(queue) {

    return Rx.Observable.create(obs => {

        const lock = queue.lock;

        lockFile.unlock(lock, function () {
            obs.onNext();
            obs.onCompleted();
        });

        return function () {
            console.log('disposing releaseLock()');
        }
    });
}

function initialize(queue) {

    console.log('ZOOOOOOOM');

    return Rx.Observable.create(obs => {

        console.log('ZAAAAAAAAAAAAAAAAAAAAAM');
        obs.onNext(!!queue.isReady);
        obs.onCompleted();

        return function () {
            console.log('disposing initialize()');
        }
    });

}


function Queue(obj) {

    const fp = this.filepath = obj.filepath;
    this.lock = path.resolve(fp + '.lock');
    this.dateCreated = new Date();
    this.topIsHead = !!obj.topIsHead;

    const values = [];
    this.obs = Rx.Observable.create(obs => {
        this._push = function (val) {
            console.log('pushing val => ', val);
            values.push(val);
            obs.onNext(val);
        };
    });

    //observe "dequeue" events
    this.obsDequeue = Rx.Observable.create(obs => {
        this._shift = function () {         // defining instance methods here might be pretty bad
            const val = values.shift();
            obs.onNext(val);   // !! when we push to array, we also fire an observable event
        };
    });

    this.isReady = false;

    this.init = function () {
        if (this.isReady) {
            return Rx.Observable.create(obs => {
                obs.onNext();
                obs.onCompleted();
            });
        }
        else {
            return acquireLock(this)
                .flatMap(() => writeFile(this, ''))
                .flatMap(() => releaseLock(this))
                .catch(e => {
                    console.error(e.stack || e);
                    return releaseLock(this);
                }).finally(() => {
                    this.isReady = true;
                })

        }

    };
}


Queue.prototype.peek = function () {
    return this.values[0];
};

Queue.prototype.read = function () {

    return this.obs
        .map(val => {
            return JSON.parse(val);
        })
        .filter(val => {
            return !val.isRead;
        })

};


Queue.prototype.add = function (lines) {

    lines = _.flattenDeep([lines]);

    return this.init()
        .flatMap(() => {
            console.log('acquiring lock...');
            return acquireLock(this)
        })
        .flatMap(() => {
            return appendFile(this, lines)
        })
        .flatMap(lines => {
            return Rx.Observable.create(obs => {
                lines.forEach(l => this._push(l));
                obs.onNext();
                obs.onCompleted();
            });
        })
        .flatMap(() => releaseLock(this))
        .catch(err => {
            console.error(err.stack || err);
            return releaseLock(this);
        });

};


module.exports = Queue;
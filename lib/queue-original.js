/**
 * Created by oleg on 12/15/16.
 */

const util = require('util');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const lockFile = require('lockfile');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');

// observable persistent text queue

// obsteque


//http://stackoverflow.com/questions/30423413/node-js-streams-vs-observables

//TODO: make it work with RxJS
//TODO: avoid reading entire file
//TODO: http://stackoverflow.com/questions/33324227/rxjs-how-would-i-manually-update-an-observable
//TODO: make each line with a UID and a read/not read yet


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


function removeOneLine(queue) {

    return readFile(queue)
        .flatMap(data => {
            // split by newline and filter out empty lines
            const lines = String(data).split('\n').filter(l => String(l).trim().length);
            const l = lines.shift();
            return writeFile(queue)
            //return line that got shifted off queue
                .flatMap(() => l);

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
                console.log('next/completed');
                obs.onNext();
                obs.onCompleted();
            }
        });

        return function () {
            console.log('disposing writeFile()');
        }
    });

}

function getLock(queue) {
    const lock = queue.lock;
    return Rx.Observable.create(obs => {
        console.log('lloooooock: ', lock);
        lockFile.lock(lock, function (err) {
            if (err) {
                console.log('eeeeeeaaaarrrr => ', err.stack);
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


// function readFile(queue) {
//     const lock = queue.lock;
//     const fp = queue.filepath;
//     return Rx.Observable.create(obs => {
//         lockFile.lock(lock, function (err) {
//             if (err) {
//                 console.error('eeee => ', err.stack);
//                 obs.onError(err);
//             }
//             else {
//                 fs.readFile(fp, 'utf8', function (err, data) {
//                     lockFile.unlock(lock, function () {
//                         if (err) {
//                             console.log('errrror => ', err.stack);
//                             obs.onError(err);
//                         }
//                         else {
//                             obs.onNext(data);
//                             obs.onCompleted();
//                         }
//                     });
//                 });
//             }
//         });
//
//         return function () {
//             console.log('disposing getLockReadFile()');
//         }
//     });
// }


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

        console.log('iisss ready...');
        obs.onNext(!!queue.isReady);
        // obs.onCompleted();

        return function () {
            console.log('XXXXXXXXXXXXXXX');
        }
    });

}


function Queue(obj) {

    // EventEmitter.call(this);
    const fp = this.filepath = obj.filepath;
    this.lock = path.resolve(fp + '.lock');
    console.log('lockpath => ', this.lock);
    this.dateCreated = new Date();
    this.topIsHead = !!obj.topIsHead;

    const values = [];

    console.log('one');
    var i = 0;
    this.obs = Rx.Observable.create(obs => {

        console.log('two');
        this._push = function (val) {
            console.log('pushing val => ' + i++, val);
            values.push(val);
            obs.onNext(val);
        };

        this._unshift = function (val) {
            values.unshift(val);
        };


    });

    console.log('three');

    console.log('in init first...');

    this.init = function () {
        return initialize(this)
            .flatMap(isReady => {
                console.log(' iiiiisss ready...');
                if (!isReady) {
                    this.isReady = true;
                    console.log('was not ready yet....');
                    return getLock(this)
                        .flatMap(() => writeFile(this, ''))
                        .flatMap(() => releaseLock(this))
                        .catch(e => {
                            console.error(e.stack || e);
                            return releaseLock(this);
                        })
                }
                else {
                    console.log('was already ready!!');
                    return Rx.Observable.create(obs => {
                            obs.onNext();
                            obs.onCompleted();
                    });
                }
            });
    };


}

// util.inherits(Queue, EventEmitter);

Queue.create = function (obj) {
    return new Queue(obj);
};


Queue.prototype.peek = function () {
    return this.values[0];
};


Queue.prototype.removeMatching = function (line) {

};


Queue.prototype.read = function () {

    return this.obs
        .map(val => {
            console.log('map val => ', val);
            return JSON.parse(val);
        })
        .filter(val => {
            console.log('filtered val => ', val);
            return !val.isRead;
        })

};


Queue.prototype.add = function (lines) {

    lines = _.flattenDeep([lines]);

    console.log('add => ', lines);

    return this.init()
        .flatMap(() => {
            console.log('gettting lock');
            return getLock(this)
        })
        .flatMap(() => {
            console.log('lines => ', lines);
            return appendFile(this, lines)
        })
        .flatMap(lines => {
            console.log('llllllineszzzz => ', lines);
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


Queue.prototype.dequeue = function () {

    return this.init()
        .flatMap(() => getLock(this))
        .flatMap(() => removeOneLine(this))
        .flatMap(l => releaseLock(this))
        .catch(e => {
            console.error(e.stack || e);
            return releaseLock(this);
        })

};

// Queue.prototype.add = function (line, cb) {
//
//     getLock(this, err => {
//         if (err) {
//             this.emit('error', err);
//             cb && cb(err);
//         }
//         else {
//             fs.appendFile(this.filepath, line, err => {
//                 if (err) {
//                     this.emit('error', err);
//                     cb && cb(err);
//                 }
//             });
//         }
//     });
// };


Queue.prototype.destroy = function () {

    this.destroyed = true;
    fs.unlink(this.filepath, (err) => {
        if (err) {
            this.emit('error', err);
        }
        else {
            this.emit('destroyed', {
                filepath: this.filepath,
                dateCreated: this.dateCreated,
                dateDestroyed: new Date()
            });
        }
    });

    return this;
};

Queue.prototype.destroyImmediately = function () {

    this.destroyed = true;
    fs.unlink(this.filepath, (err) => {
        if (err) {
            this.emit('error', err);
        }
        else {
            this.emit('destroyed', {
                filepath: this.filepath,
                dateCreated: this.dateCreated,
                dateDestroyed: new Date()
            });
        }
    });

    return this;
};


module.exports = Queue;
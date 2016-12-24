'use striiiict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const Rx = require('rx-lite');
const _ = require('lodash');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');

const start = Date.now();


const tail = require('./tail');

// const Tail = require('tail').Tail;


///////////////////////////////////////////////////////////////////////////////////////////////////////////////

const {

    acquireLock,
    releaseLock,
    genericAppendFile,
    readFile,
    writeFile,
    removeOneLine,
    appendFile,
    makeGenericObservable

} = require('./helpers');

///////////////////////////////////////////////////////////////////////////////////////////////////////////////



function Queue(obj) {

    const fp = this.filepath = obj.filepath;
    this.lock = uuidV4();
    this.dateCreated = new Date();

    this.obsEnqueue = new Rx.Subject();
    this.obsDequeue = new Rx.Subject();


    this._shift = function () {
        const val = values.shift();
        if (val) {
            this.obsDequeue.onNext(val);
        }
    };

    // const tail = new Tail(fp);

    tail(fp).on('data', data => {
        data = String(data).trim();
        if(data){
            this.obsEnqueue.onNext(JSON.parse(data));
        }
    });

    // tail.on('error', function(error) {
    //     console.log('error => ', error);
    // });

    this.isReady = false;

    // init both creates the queue file if it does not exist, and finds/initializes the live-mutex
    this.init = function () {

        if (this.isReady) {
            return makeGenericObservable();
        }

        var lockAcquired = false;

        return acquireLock(this)
            .flatMap(() => genericAppendFile(this, '\n'))
            .flatMap(() => {
                lockAcquired = true;
                return releaseLock(this)
            }).map(() => {
                this.isReady = true;
            })
            .catch(e => {
                console.error(e.stack || e);
                if (lockAcquired) {
                    return releaseLock(this);
                }
                else {
                    return makeGenericObservable();
                }
            });
    };
}



Queue.prototype.readUnique = function () {

    var ret = null;
    var lockAcquired = false;

    return this.obsEnqueue
        .flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            return removeOneLine(this);
        })
        .flatMap(val => {
            ret = val;
            if(ret){
                console.log('\n', colors.blue(' => ret =>'), colors.cyan(ret),'\n');
            }
            return releaseLock(this);
        })
        .map(() => {
             if(ret){
                 return JSON.parse(ret);
             }
        })
        .catch(e => {
            console.log('error time => ', Date.now() - start);
            console.error(e.stack || e);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return makeGenericObservable();
            }
        });

};

Queue.prototype.readAll = function () {

    return this.obsEnqueue;

};


Queue.prototype.add = Queue.prototype.enqueue = function (lines) {

    lines = _.flattenDeep([lines]);

    var lockAcquired = false;

    return this.init()
        .flatMap(() => {
            return acquireLock(this)
        })
        .flatMap(() => {
            lockAcquired = true;
            return appendFile(this, lines)
        })
        .flatMap(() => releaseLock(this))
        .catch(err => {
            console.error(' => add / enqueue error => \n', err.stack || err);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return makeGenericObservable();
            }
        });

};


Queue.prototype.remove = Queue.prototype.dequeue = function () {

    var lockAcquired = false;

    return this.init()
        .flatMap(() => acquireLock(this))
        .flatMap(() => {
            lockAcquired = true;
            return removeOneLine(this)
        })
        .flatMap(l => releaseLock(this))
        .catch(e => {
            console.error(e.stack || e);
            if (lockAcquired) {
                return releaseLock(this);
            }
            else {
                return makeGenericObservable();
            }
        });

};

module.exports = Queue;
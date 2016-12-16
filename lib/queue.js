/**
 * Created by oleg on 12/15/16.
 */

const util = require('util');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const lockFile = require('lockfile');


//TODO: make it work with RxJS
//TODO: avoid reading entire file


function emitErrorOrFireCallback(err, queue, cb){


}


function getLock(queue, cb){
    const lock = queue.lock;
    lockFile.lock(lock, {}, cb);
}

function getLockReadFile(queue, cb){
    const lock = queue.lock;
    const fp = queue.filepath;
    lockFile.lock(lock, {}, function(err){
        if(err) {
            cb(err);
        }
        else{
            fs.readFile(fp, 'utf8', cb);
        }
    });
}



function unlock(queue, cb){
    const lock = queue.lock;
    lockFile.unlock(lock, cb);
}


function handleInitializeError(queue, cb){
    return function(err){
        if(err){
            queue.usable = false;
            queue.emit('error', err);
        }
        else{
            cb && cb(null);
        }
    }

}

function Queue(obj) {
    EventEmitter.call(this);
    const fp = this.filepath = obj.filepath;
    this.lock = path.resolve(this.filepath,'.lock');
    this.usable = true;
    this.dateCreated = new Date();
    this.topIsHead = !!obj.topIsHead;
    // try to open file for reading and writing, if it exists, we emit error

    getLock(this, handleInitializeError(this, () =>{
        fs.writeFile(fp, '', {flag: 'wx+'}, err => {
            if(err){
                this.usable = false;
                this.emit('error', err);
            }
        });
    }));

}

util.inherits(Queue, EventEmitter);

Queue.create = function (obj) {
    return new Queue(obj);
};


Queue.prototype.peek = function(cb){

   getLockReadFile(this, (err,data) => {

        if(err){
            this.emit('error', err);
        }
        else{
            const lines = String(data).split('\n').filter(function (l) {
                // filter out empty lines
                return String(l).trim().length > 0;
            });

            const first = String(lines[0] || '').trim();
            cb(null, first);
        }

    });

};


Queue.prototype.removeMatching = function(line){

};


Queue.prototype.add = function(line, cb){

    getLock(this, err => {
        if(err){
            this.emit('error', err);
            cb && cb(err);
        }
        else{
            fs.appendFile(this.filepath, line, err => {
               if(err){
                   this.emit('error', err);
                   cb && cb(err);
               }
            });
        }
    });
};





Queue.prototype.destroy = function(){

    this.destroyed = true;
    fs.unlink(this.filepath, (err) => {
        if(err){
            this.emit('error', err);
        }
        else{
            this.emit('destroyed', {
                filepath: this.filepath,
                dateCreated: this.dateCreated,
                dateDestroyed: new Date()
            });
        }
    });

    return this;
};

Queue.prototype.destroyImmediately = function(){

    this.destroyed = true;
    fs.unlink(this.filepath, (err) => {
        if(err){
            this.emit('error', err);
        }
        else{
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
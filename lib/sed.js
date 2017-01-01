'use strict';

const cp = require('child_process');
const Rx = require('rxjs');
const _ = require('lodash');

const colors = require('colors/safe');
const path = require('path');

const debug = require('debug')('cmd-queue');

/////////////////////////////////////////////////////////////////////////////////////////////

module.exports = function (queue, pattern, count, choice) {

    count = count || 1;

    const patterns = [];

    var priority = 1;
    var cycleNumber = null;

    if (queue.priority) {

        choice = 'priority';

        // queue.priorityCycleIndex = queue.priorityCycleIndex + count;
        const ind = queue._priority.priorityCycleIndex++;
        console.log('priority cycle index => ', ind);
        cycleNumber = ind % queue._priority.totalPriorityCycles;
        console.log(' => Current cycle-number => ', cycleNumber);

        var accumulatedValue = 0;

        queue._priority.levels.every(function (obj) {

            accumulatedValue += obj.cycles;
            if(cycleNumber <= accumulatedValue){
                priority = obj.level;
                return false;
            }

            return true;
        });

        console.log(' => Priority => ', priority);

        const nums = [];

        for(var i = 0; i< priority; i++){
            nums.push(String(i+1));
        }

        var pr ='"priority":' + '(' + nums.join('|') + '),';

        console.log('pr => ', pr);

        patterns.push(pr);
    }


    if(patterns.length < 1){
        patterns.push('\\S+');
    }

    const $pattern = JSON.stringify(patterns);

    var exec;
    switch (choice) {
        case 'single':
            exec = 'blank.py';
            break;
        case 'multiple':
            exec = 'blank-multiple.py';
            break;
        case 'find-one':
            exec = 'find-one.py';
            break;
        case 'priority':
            exec = 'blank-priority.py';
            break;
        default:
            throw new Error(' => Implementation error => Switch fallthrough.');
    }

    return Rx.Observable.create(obs => {

        const file = queue.filepath;
        const execPath = path.resolve(__dirname, exec);

        console.log('execPath => ', execPath);
        console.log('file => ', file);
        console.log('pattern => ', $pattern);
        console.log('count => ', count);


        const n = cp.spawn(execPath, [file, $pattern, count, priority, 20]);

        n.once('error', function (err) {
            console.error(colors.red(' => spawn error => \n', err.stack || err));
            obs.error(err);
        });

        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');

        n.stderr.on('data', function (d) {
            if (d && String(d).trim())
                console.error('\n', colors.red(' => sed spawn stderr => '), '\n', d);
        });

        var data = '';

        n.stdout.on('data', function (d) {
            debug(' => Data from python => ', d);
            data += d;
        });

        n.once('close', function (code) {
            if (code > 0) {
                console.error(colors.bgRed(' => Exit code of sed command => '), code);
            }

            n.stderr.removeAllListeners();
            n.stdout.removeAllListeners();
            n.removeAllListeners();

            obs.next(data);
            obs.complete();
        });

        return function () {
            // console.log('disposing appendFile()');
        }

    });

};
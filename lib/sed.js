'use strict';


//core
const cp = require('child_process');
const path = require('path');
const util = require('util');

//npm
const rpl = require('replace-line');
const Rx = require('rxjs')
const _ = require('lodash');
const colors = require('colors/safe');

//project
const debug = require('debug')('cmd-queue');

/////////////////////////////////////////////////////////////////////////////////////////////


module.exports = function (queue, pattern, isReplace, $count) {

    const file = queue.filepath;
    const patterns = _.flattenDeep([pattern]);

    //force boolean to string...s
    isReplace = String(isReplace);

    var priority = 0;

    if (queue.priority) {

        // queue.priorityCycleIndex = queue.priorityCycleIndex + count;
        const ind = queue._priority.priorityCycleIndex++;
        const cycleNumber = ind % queue._priority.totalPriorityCycles;

        // console.log('priority cycle index => ', ind);
        // console.log(' => Current cycle-number => ', cycleNumber);

        var accumulatedValue = 0;

        queue._priority.levels.every(function (obj) {

            accumulatedValue += obj.cycles;
            if (cycleNumber <= accumulatedValue) {
                priority = obj.level;
                return false;
            }

            return true;
        });

    }

    if (patterns.length < 1) {
        patterns.push('\\S+');
    }

    return Rx.Observable.create(obs => {

        process.nextTick(function(){

            const count = $count || 1;
            const prioritySearchCap = 20;
            const data = rpl.run(file, patterns, isReplace, count, priority, prioritySearchCap);

            const d = {
                file:file,
                pattern: pattern,
                isReplace: isReplace,
                count: count
            };

            // console.log('\n',' => data from C++ => \n', util.inspect(d), '\n',data,'\n');

            const ret = data.map(function (l) {
                try {
                    return JSON.parse(String(l).trim());
                }
                catch (err) {
                    return '';
                }

            }).filter(function (l) {
                return l;
            });

            obs.next(ret);
            obs.complete();

        });


    });

};

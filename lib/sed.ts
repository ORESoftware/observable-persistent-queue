'use strict';

//core
import cp = require('child_process');
import path = require('path');
import util = require('util');

//npm
import rpl = require('replace-line');
import Rx = require('rxjs')
import _ = require('lodash');
import colors = require('colors/safe');

//project
const debug = require('debug')('cmd-queue');

/////////////////////////////////////////////////////////////////////////////////////////////

export = function (queue: any, pattern: any, isReplace: any, $count: any) {

    const file = queue.filepath;
    const patterns = _.flattenDeep([pattern]);

    //force boolean to string...s
    isReplace = String(isReplace);

    let priority = 0;

    if (queue.priority) {

        // queue.priorityCycleIndex = queue.priorityCycleIndex + count;
        const ind = queue._priority.priorityCycleIndex++;
        const cycleNumber = ind % queue._priority.totalPriorityCycles;

        // console.log('priority cycle index => ', ind);
        // console.log(' => Current cycle-number => ', cycleNumber);

        let accumulatedValue = 0;

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

'use strict';
const rpl = require("replace-line");
const Rx = require("rxjs");
const _ = require("lodash");
const debug = require('debug')('cmd-queue');
module.exports = function (queue, pattern, isReplace, $count) {
    const file = queue.filepath;
    const patterns = _.flattenDeep([pattern]);
    isReplace = String(isReplace);
    let priority = 0;
    if (queue.priority) {
        const ind = queue._priority.priorityCycleIndex++;
        const cycleNumber = ind % queue._priority.totalPriorityCycles;
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
        process.nextTick(function () {
            const count = $count || 1;
            const prioritySearchCap = 20;
            const data = rpl.run(file, patterns, isReplace, count, priority, prioritySearchCap);
            const d = {
                file: file,
                pattern: pattern,
                isReplace: isReplace,
                count: count
            };
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

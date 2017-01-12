'use strict';
const assert = require("assert");
const rpl = require("replace-line");
const _ = require("lodash");
const rxjs_1 = require("rxjs");
const debug = require('debug')('cmd-queue');
module.exports = function sed(q, pattern, $isReplace, $count) {
    const file = q.filepath;
    const patterns = _.flattenDeep([pattern]);
    const isReplace = String($isReplace);
    assert(isReplace === 'true' || isReplace === 'false', ' => Boolean to string conversion failed.');
    let priority = 0;
    if (q.priority) {
        const ind = q._priority.priorityCycleIndex++;
        const cycleNumber = ind % q._priority.totalPriorityCycles;
        let accumulatedValue = 0;
        q._priority.levels.every(function (obj) {
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
    return rxjs_1.Observable.create(obs => {
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

'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var rpl = require("replace-line");
var Rx_1 = require("rxjs/Rx");
var _ = require("lodash");
exports.sed = function (q, pattern, $isReplace, $count) {
    var file = q.filepath;
    var patterns = _.flattenDeep([pattern]);
    var isReplace = String($isReplace);
    assert(isReplace === 'true' || isReplace === 'false', ' => Boolean to string conversion failed.');
    var priority = 0;
    if (q.priority) {
        var ind = q._priority.priorityCycleIndex++;
        var cycleNumber_1 = ind % q._priority.totalPriorityCycles;
        var accumulatedValue_1 = 0;
        q._priority.levels.every(function (obj) {
            accumulatedValue_1 += obj.cycles;
            if (cycleNumber_1 <= accumulatedValue_1) {
                priority = obj.level;
                return false;
            }
            return true;
        });
    }
    if (patterns.length < 1) {
        patterns.push('\\S+');
    }
    return Rx_1.Observable.create(function (obs) {
        process.nextTick(function () {
            var count = $count || 1;
            var prioritySearchCap = 20;
            var data = rpl.run(file, patterns, isReplace, count, priority, prioritySearchCap);
            var d = {
                file: file,
                pattern: pattern,
                isReplace: isReplace,
                count: count
            };
            var ret = data.map(function (l) {
                try {
                    return JSON.parse(String(l).trim());
                }
                catch (err) {
                    return '';
                }
            })
                .filter(function (l) {
                return l;
            });
            obs.next(ret);
            obs.complete();
        });
    });
};

'use strict';
var cp = require('child_process');
var path = require('path');
var util = require('util');
var rpl = require('replace-line');
var Rx = require('rxjs');
var _ = require('lodash');
var colors = require('colors/safe');
var debug = require('debug')('cmd-queue');
module.exports = function (queue, pattern, isReplace, $count) {
    var file = queue.filepath;
    var patterns = _.flattenDeep([pattern]);
    isReplace = String(isReplace);
    var priority = 0;
    if (queue.priority) {
        var ind = queue._priority.priorityCycleIndex++;
        var cycleNumber_1 = ind % queue._priority.totalPriorityCycles;
        var accumulatedValue = 0;
        queue._priority.levels.every(function (obj) {
            accumulatedValue += obj.cycles;
            if (cycleNumber_1 <= accumulatedValue) {
                priority = obj.level;
                return false;
            }
            return true;
        });
    }
    if (patterns.length < 1) {
        patterns.push('\\S+');
    }
    return Rx.Observable.create(function (obs) {
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
            }).filter(function (l) {
                return l;
            });
            obs.next(ret);
            obs.complete();
        });
    });
};

'use strict';
const assert = require("assert");
const util = require("util");
const priorityMaxSearchMin = 5;
const priorityMaxSearchMax = 300;
module.exports = function (obj, q) {
    q.priority = obj.priority;
    assert(typeof q.priority === 'object' && !Array.isArray(q.priority), ' => OPQ usage error => "priority option should be an object.');
    q._priority = {};
    const first = q.priority.first;
    assert(Number.isInteger(first), ' => priority.first must be an integer, greater than 5 and less than 300');
    assert(first > 5 && first < 300, ' => priority.first must be an integer, greater than 5 and less than 300');
    assert.equal(Array.isArray(q.priority.levels), true, ' => priority.levels should be an array.');
    assert(q.priority.levels.length > 1, ' => You must define at least two priority levels.');
    let il = q._priority.internalLevels = [];
    q._priority.levels = q.priority.levels.sort((a, b) => {
        return b.level > a.level;
    });
    q._priority.first = first;
    q._priority.totalPriorityCycles = q.priority.levels.map(function (obj) {
        assert(Number.isInteger(obj.level), ' => OPQ usage error => "level" must be an integer => ' + util.inspect(obj));
        assert(obj.level > 0 && obj.level < 21, ' => OPQ usage error => Priority level must be an integer which ranges from 1-20');
        assert(Number.isInteger(obj.cycles), ' => OPQ usage error => "cycles" must be an integer => ' + util.inspect(obj));
        assert(obj.cycles > 0 && obj.cycles < 41, ' => OPQ usage error => "cycles" must be an integer which ranges from 1-40');
        il.push(obj.level);
        return obj.cycles;
    }).reduce(function (a, b) {
        return a + b;
    });
    il = il.sort();
    console.log(' => Lowest priority item => ', il[0]);
    console.log(' => Highest priority => ', il[il.length - 1]);
    q._priority.priorityCycleIndex = 0 + q._priority.totalPriorityCycles;
    console.log(' => Total number of cycles => ', q._priority.priorityCycleIndex);
};

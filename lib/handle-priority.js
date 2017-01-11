'use strict';
const assert = require("assert");
const util = require("util");
const priorityMaxSearchMin = 5;
const priorityMaxSearchMax = 300;
module.exports = function _handlePriority(obj, queue) {
    queue.priority = obj.priority;
    assert(typeof queue.priority === 'object' && !Array.isArray(queue.priority), ' => OPQ usage error => "priority option should be an object.');
    queue._priority = {};
    const first = queue.priority.first;
    assert(Number.isInteger(first), ' => priority.first must be an integer, greater than 5 and less than 300');
    assert(first > 5 && first < 300, ' => priority.first must be an integer, greater than 5 and less than 300');
    assert.equal(Array.isArray(queue.priority.levels), true, ' => priority.levels should be an array.');
    assert(queue.priority.levels.length > 1, ' => You must define at least two priority levels.');
    let il = queue._priority.internalLevels = [];
    queue._priority.levels = queue.priority.levels.sort(function (a, b) {
        return b.level > a.level;
    });
    queue._priority.first = first;
    queue._priority.totalPriorityCycles = queue.priority.levels.map(function (obj) {
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
    queue._priority.priorityCycleIndex = 0 + queue._priority.totalPriorityCycles;
    console.log(' => Total number of cycles => ', queue._priority.priorityCycleIndex);
};

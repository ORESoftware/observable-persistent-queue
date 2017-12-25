'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var util = require("util");
var logging_1 = require("./logging");
var priorityMaxSearchMin = 5;
var priorityMaxSearchMax = 300;
exports.handlePriority = function (obj, q) {
    q.priority = obj.priority;
    assert(typeof q.priority === 'object' && !Array.isArray(q.priority), ' => OPQ usage error => "priority option should be an object.');
    q._priority = {};
    var first = q.priority.first;
    assert(Number.isInteger(first), ' => priority.first must be an integer, greater than 5 and less than 300');
    assert(first > 5 && first < 300, ' => priority.first must be an integer, greater than 5 and less than 300');
    assert.equal(Array.isArray(q.priority.levels), true, ' => priority.levels should be an array.');
    assert(q.priority.levels.length > 1, ' => You must define at least two priority levels.');
    var il = q._priority.internalLevels = [];
    q._priority.levels = q.priority.levels.sort(function (a, b) {
        return b.level - a.level;
    });
    q._priority.first = first;
    q._priority.totalPriorityCycles = q.priority.levels.map(function (obj) {
        assert(Number.isInteger(obj.level), ' => OPQ usage error => "level" must be an integer => ' + util.inspect(obj));
        assert(obj.level > 0 && obj.level < 21, ' => OPQ usage error => Priority level must be an integer which ranges from 1-20');
        assert(Number.isInteger(obj.cycles), ' => OPQ usage error => "cycles" must be an integer => ' + util.inspect(obj));
        assert(obj.cycles > 0 && obj.cycles < 41, ' => OPQ usage error => "cycles" must be an integer which ranges from 1-40');
        il.push(obj.level);
        return obj.cycles;
    })
        .reduce(function (a, b) {
        return a + b;
    });
    il = il.sort();
    logging_1.log.info('Lowest priority item:', il[0]);
    logging_1.log.info('Highest priority:', il[il.length - 1]);
    q._priority.priorityCycleIndex = 0 + q._priority.totalPriorityCycles;
    logging_1.log.info('Total number of cycles:', q._priority.priorityCycleIndex);
};

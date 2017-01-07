
//core
const assert = require('assert');
const util = require('util');

//npm


//project


///////////////////////////////////////////////////////////////////////


const priorityMaxSearchMin = 5;
const priorityMaxSearchMax = 300;





///////////////////////////////////////////////////////////////////////


module.exports = function _handlePriority(obj, queue){

    queue.priority = obj.priority;

    assert(typeof queue.priority === 'object' && !Array.isArray(queue.priority),
        ' => OPQ usage error => "priority option should be an object.');

    // queue._priority is the internal use of the user-provided queue.priority object.
    queue._priority = {};

    // how many items to look at, so we don't look at the whole queue everytime
    const first = queue.priority.first;
    assert(Number.isInteger(first), ' => priority.first must be an integer, greater than 5 and less than 300');
    assert(first > 5 && first < 300, ' => priority.first must be an integer, greater than 5 and less than 300');
    assert.equal(Array.isArray(queue.priority.levels), true, ' => priority.levels should be an array.');
    assert(queue.priority.levels.length > 1, ' => You must define at least two priority levels.');

    var il = queue._priority.internalLevels = [];

    queue._priority.levels = queue.priority.levels.sort(function (a, b) {
        return b.level > a.level;
    });


    // TODO: this should be renamed from "first" to "priority_max_search"
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

    // in order for modulus arithmetic to work, we need to start at 0 + that
    queue._priority.priorityCycleIndex = 0 + queue._priority.totalPriorityCycles;
    console.log(' => Total number of cycles => ', queue._priority.priorityCycleIndex);


};
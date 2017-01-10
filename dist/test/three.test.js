var path = require('path');
var util = require('util');
var fs = require('fs');
var Queue = require('../lib/queue');
var q = new Queue({
    port: 7575,
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});
var suman = require('suman');
var Test = suman.init(module);
Test.create('test unique', function (assert) {
    var results = [];
    var subscriptions;
    setTimeout(function () {
        subscriptions = new Array(5).fill().map(function (item, index) {
            var obs = q.eqStream();
            return obs.subscribe(function (x) { return console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'); }, function (e) { return console.log('\n', ' => ' + index + ' error: ', e.stack); }, function () { return console.log('\n', ' => ' + index + ' completed'); });
        });
    }, 1000);
    var interval = setInterval(function () {
        q.enqueue('jimmy').subscribe(function (x) { return console.log('\n', ' => dequeue next: ', util.inspect(x)); }, function (e) { return console.log('\n', ' => dequeue error: ', e.stack); }, function () { return console.log('\n', ' => dequeue completed!! '); });
    }, 30);
    this.it.cb('test', function (t) {
        setTimeout(function () {
            clearInterval(interval);
            subscriptions.forEach(function (s) {
                s.unsubscribe();
            });
            var isUnique = results.every(function (item, index) {
                console.log(' => item => ', item);
                return results.indexOf(item) === index;
            });
            try {
                assert(isUnique, ' => Results contains duplicates.');
                t.pass();
            }
            catch (err) {
                t.fail(err);
            }
        }, 5000);
    });
});

var path = require('path');
var util = require('util');
var fs = require('fs');
var Queue = require('../lib/queue');
var q = new Queue({
    port: 8888,
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});
var stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};
function read() {
    setTimeout(function () {
        var subs = new Array(5).fill().map(function (item, index) {
            return function () {
                var obs = q.eqStream();
                return obs.subscribe(function (x) { return console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'); }, function (e) { return console.log('\n', ' => ' + index + ' error: ', e.stack); }, function () { return console.log('\n', ' => ' + index + ' completed'); });
            };
        });
        if (true) {
            subs.forEach(function (fn) {
                fn();
            });
        }
    }, 3000);
}
read();
setInterval(function () {
    q.dequeue()
        .subscribe(function (x) { return console.log('\n', ' => dequeue next: \n', util.inspect(x)); }, function (e) { return console.log('\n', ' => dequeue error: ', e.stack); }, function () { return console.log('\n', ' => dequeue completed!! '); });
}, 300);

var path = require('path');
var util = require('util');
var fs = require('fs');
var colors = require('colors/safe');
var Queue = require('../lib/queue');
var q = new Queue({
    port: 9950,
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});
var stderr = process.stderr.write;
process.stderr.write = function (val) {
    stderr.apply(process.stderr, arguments);
    fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};
q.enq('zoom')
    .subscribe(function (x) {
    console.log('\n', ' => dequeue next: \n', util.inspect(x));
    process.exit(0);
}, function (e) { return console.log('\n', ' => dequeue error: ', e.stack); }, function () { return console.log('\n', ' => dequeue completed!! '); });

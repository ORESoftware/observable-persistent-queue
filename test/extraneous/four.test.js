
const path = require('path');
const util = require('util');
const fs = require('fs');
const colors = require('colors/safe');
const Queue = require('../../lib/queue.js').Queue;

const q = new Queue({
  port: 8888,
  fp: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});

const stderr = process.stderr.write;
process.stderr.write = function (val) {
  stderr.apply(process.stderr, arguments);
  fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};

setInterval(function () {
  // q.enq('zoom').subscribe();
  q.enq('zoom');
}, 30);

setInterval(function(){
  // const c = q.deq({min: 5, count: 5, wait: true})
  const c = q.deq()
  .subscribe(
    function (v) {
      console.log(colors.green(' => zzz dequeue next: '), '\n', util.inspect(v));
    },
    function (e) {
      console.log(' => zzz dequeue error: ', e.stack)
    },
    function () {
      console.log(colors.bgRed(' => zzz dequeue completed!! '))
    }
  );

}, 10);









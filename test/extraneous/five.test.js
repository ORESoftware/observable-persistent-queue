'use strict';

const path = require('path');
const util = require('util');
const fs = require('fs');
const Queue = require('../../lib/queue').Queue;

const q = new Queue({
  port: 8888,
  filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});

const stderr = process.stderr.write;
process.stderr.write = function (val) {
  stderr.apply(process.stderr, arguments);
  fs.appendFileSync(path.resolve(process.env.HOME + '/software_testing/dogs.debug.txt'), String(val));
};

const async = require('async');

async.whilst(
  function () {
    return true;
  },
  function (cb) {

    console.log('starting...');

    q.enq(['zoom', 'bar', 'baz'], {
      controlled: true
    })
    .subscribe(
      function (x) {
        console.log(' => add next: \n', util.inspect(x));
        // cb();
      },
      function (e) {
        console.log(' => dequeue error: ', e.stack);
        cb(e);
      },
      () => console.log( ' => dequeue completed!! ')
    )

  },
  function (err, n) {
    // 5 seconds have passed, n = 5
    if (err) {
      throw err;
    }

  }
);




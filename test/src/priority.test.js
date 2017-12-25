const suman = require('suman');
const Test = suman.init(module, {
  pre: ['create-test-dir']
});

const colors = require('colors/safe');

Test.create(function (b, assert, fs, path, Queue, Rx, suite, userData, before, it, after) {

  const id = b.uniqueId;
  const pre = userData['suman.once.pre.js'];
  // const p = pre['create-test-dir'];
  const p = path.join(process.env.HOME, 'software_testing', 'opq');
  Rx = require('rxjs/Rx');
  Queue = require('../../lib/queue').Queue;

  const q = new Queue({
    port: 8888,
    fp: path.resolve(p + '/spaceships-' + id + '.txt'),
    priority: {
      first: 20,
      levels: [
        {
          level: 3, cycles: 5
        },
        {
          level: 4, cycles: 7
        },
        {
          level: 2, cycles: 3
        },
        {
          level: 1, cycles: 2
        }
      ]
    }
  });

  before(h => {
    return q.init();
  });

  before.cb({timeout: 5000}, h => {

    q.getClient().requestLockInfo(q.getLock(), function (err, data) {

      if (err) {
        return h.fail(err);
      }

      console.log(' => Locked data after queue init() => ', data, '\n');
      h.done();

    });

  });

  before.cb({timeout: 5000}, h => {

    Rx.Observable.interval(10)
    .take(30)
    .map(function () {
      const p = Math.ceil(Math.random() * 4);
      return q.enq('foo bar baz', {
        priority: p
      });
    })
    .concatAll()
    .subscribe(
      function (v) {
        if (v.error) {
          console.log(colors.yellow.bold('next => '), v);
        }
      },
      function (e) {
        console.error(e);
        h.fatal(e);
      },
      function () {

        q.getClient().requestLockInfo(q.getLock(), function (err, data) {

          if (err) {
            return h.fail(err);
          }

          console.log('\n', ' => Locked data after all enqueues => ', data, '\n');

          console.log(colors.bgRed('all done'));
          h.done();

        });
      }
    );

  });

  it.cb('drains queue (priority)', {timeout: 6000}, t => {

    const s = Date.now();
    q.drain({backpressure: true})
    .backpressure(function (data, cb) {
      setTimeout(cb, 10);
    })
    .subscribe(
      function (v) {
        console.log(colors.yellow.bold(' next enqueue item => '), '\n', v);
      },
      t.fail,
      function () {

        q.getClient().requestLockInfo(q.getLock(), function (err, data) {

          if (err) {
            return t.fail(err);
          }

          console.log('\n', ' => Locked data after drain => ', data, '\n');

          console.log('complete');
          console.log('time => ', Date.now() - s);
          t.done();

        });

      }
    );

  });

  after.cb({timeout: 2000}, h => {

    q.getClient().requestLockInfo(q.getLock(), function (err, data) {

      if (err) {
        return h.fail(err);
      }

      console.log('\n', ' => Locked data before isEmpty() => ', data, '\n');

      q.getSize().subscribe(
        function (v) {
          console.log('v => ', v);
          assert.equal(v.count, 0, ' => Count is not correct.');
        },
        function (e) {
          console.error(e);
        },
        function () {

          console.log(' => Is empty is completed');

          q.getClient().requestLockInfo(q.getLock(), function (err, data) {

            if (err) {
              return h.fail(err);
            }

            console.log('\n', 'Locked data *after* empty => ', data, '\n');
            h.done();

          });

        }
      );

    });

  });

});
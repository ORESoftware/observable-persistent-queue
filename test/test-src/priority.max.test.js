const suman = require('suman');
const Test = suman.init(module, {
    pre: ['create-test-dir']
});


//TODO: write 300 enqueue items with random priority and make sure all are drained after 50 seconds or whatever

const colors = require('colors/safe');

Test.create(__filename, {},

    function (assert, fs, path, Queue, Rx, suite, userData, before, it, after) {

        const id = suite.uniqueId;
        const pre = userData['suman.once.pre.js'];
        const p = pre['create-test-dir'];

        const q = new Queue({
            port: 8887,
            fp: path.resolve(p + '/spaceships-1' + '.txt'),
            // fp: path.resolve(p + '/spaceships-' + id + '.txt'),
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

                console.log('\n', ' => Locked data after queue init() => ', data, '\n');
                h.done();

            });

        });

        before.cb({timeout: 5000}, h => {

            Rx.Observable.interval(10)
                .take(30)
                .map(function () {
                    const p = Math.ceil(Math.random() * 4);
                    console.log(' priority level => ', p);
                    return q.enq('foo bar baz', {
                        priority: p
                    });
                })
                .concatAll()
                .subscribe(
                    function (v) {
                        if (v.error) {
                            console.log(colors.yellow.bold('next error => '), v);
                        }

                    },
                    function (e) {
                        console.error(e);
                        h.fail(e);
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


        it.cb('drains queue (priority max)', {timeout: 8000}, t => {

            const s = Date.now();
            q.drain({backpressure: true})
                .backpressure(function (data, cb) {
                    setTimeout(function () {
                        cb(null, {error: null})
                    }, 10);
                })
                .subscribe(
                    function (v) {
                        if (v.error) {
                            console.log(colors.yellow.bold(' next enqueue item => '), '\n', v);
                        }
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
                    h.wrap(function (v) {
                        console.log(' => v => ', v);
                        assert.equal(v.count, 0, ' => Count is not correct.');
                    }),
                    function (e) {
                        console.error(e);
                        h.fail(e);
                    },
                    function () {

                        console.log(' => Is empty is completed');

                        q.getClient().requestLockInfo(q.getLock(), function (err, data) {

                            if (err) {
                                return h.fail(err);
                            }

                            console.log('\n', ' => Locked data *after* empty => ', data, '\n');
                            h.done();

                        });

                    }
                );

            });

        });

    });
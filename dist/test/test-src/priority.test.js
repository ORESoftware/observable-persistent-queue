var suman = require('suman');
var Test = suman.init(module, {
    pre: ['create-test-dir']
});
var colors = require('colors/safe');
Test.create(__filename, {}, function (assert, fs, path, Queue, Rx, suite, userData) {
    var id = suite.uniqueId;
    var pre = userData['suman.once.pre.js'];
    console.error('pre =>', pre);
    var p = pre['create-test-dir'];
    console.error('p =>', p);
    console.error(' => id => ', id);
    var q = new Queue({
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
    this.before(function (h) {
        return q.init();
    });
    this.before.cb({ timeout: 5000 }, function (h) {
        q.getClient().requestLockInfo(q.getLock(), function (err, data) {
            if (err) {
                return h.fail(err);
            }
            console.log('\n', ' => Locked data after queue init() => ', data, '\n');
            h.done();
        });
    });
    this.before.cb({ timeout: 5000 }, function (h) {
        Rx.Observable.interval(10)
            .take(30)
            .map(function (val) {
            return q.enq('foo bar baz', {
                priority: val
            });
        })
            .concatAll()
            .subscribe(function (v) {
            console.log(colors.yellow.bold('next => '), v);
        }, function (e) {
            console.error(e);
            h.fail(e);
        }, function () {
            q.getClient().requestLockInfo(q.getLock(), function (err, data) {
                if (err) {
                    return h.fail(err);
                }
                console.log('\n', ' => Locked data after all enqueues => ', data, '\n');
                console.log(colors.bgRed('all done'));
                h.done();
            });
        });
    });
    this.it.cb('drains queue', { timeout: 6000 }, function (t) {
        var s = Date.now();
        q.drain({ backpressure: true })
            .backpressure(function (data, cb) {
            setTimeout(cb, 10);
        })
            .subscribe(function (v) {
            console.log(colors.yellow.bold(' next enqueue item => '), '\n', v);
        }, t.fail, function () {
            q.getClient().requestLockInfo(q.getLock(), function (err, data) {
                if (err) {
                    return t.fail(err);
                }
                console.log('\n', ' => Locked data after drain => ', data, '\n');
                console.log('complete');
                console.log('time => ', Date.now() - s);
                t.done();
            });
        });
    });
    this.after.cb({ timeout: 2000 }, function (h) {
        q.getClient().requestLockInfo(q.getLock(), function (err, data) {
            if (err) {
                return h.fail(err);
            }
            console.log('\n', ' => Locked data before isEmpty() => ', data, '\n');
            q.getSize().subscribe(function (v) {
                console.log('v => ', v);
                assert.equal(v.count, 0, ' => Count is not correct.');
            }, function (e) {
                console.error(e);
            }, function () {
                console.log(' => Is empty is completed');
                q.getClient().requestLockInfo(q.getLock(), function (err, data) {
                    if (err) {
                        return h.fail(err);
                    }
                    console.log('\n', ' => Locked data *after* empty => ', data, '\n');
                    h.done();
                });
            });
        });
    });
});

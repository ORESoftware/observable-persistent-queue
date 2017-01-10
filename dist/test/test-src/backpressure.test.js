var suman = require('suman');
var Test = suman.init(module, {
    pre: ['create-test-dir']
});
Test.create('backpressure', function (Queue, Rx, path, fs, before, it, suite, util, userData, after, describe, assert) {
    var id = suite.uniqueId;
    var pre = userData['suman.once.pre.js'];
    console.error('pre =>', pre);
    var p = pre['create-test-dir'];
    console.error('p =>', p);
    console.error(' => id => ', id);
    var q = new Queue({
        port: 3500,
        fp: path.resolve(p + '/spaceships-' + id + '.txt')
    });
    before('init queue', function (h) {
        return q.init();
    });
    var count = 6;
    before('add items to queue', function (h) {
        return Rx.Observable.range(0, count)
            .map(function (i) {
            return q.enq('frog(' + i + ')');
        })
            .concatAll();
    });
    it('has correct count', function () {
        return q.getSize()
            .do(function (data) {
            assert.equal(data.count, count, ' => Count is incorrect.');
        });
    });
    describe('count after queue', function (before, it) {
        before('drains queue', function (t) {
            return q.drain({ backpressure: true })
                .backpressure(function (data, cb) {
                setTimeout(cb, 200);
            });
        });
        it('has correct count', function () {
            return q.getSize()
                .do(function (data) {
                assert.equal(data.count, 0, ' => Count is incorrect.');
            });
        });
    });
});

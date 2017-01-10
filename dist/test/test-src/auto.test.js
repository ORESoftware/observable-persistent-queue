'use strict';
var suman = require('suman');
var Test = suman.init(module, {
    pre: ['create-test-dir']
});
Test.create(__filename, {}, function (assert, fs, path, suite, Queue, Rx, before, it) {
    var id = suite.uniqueId;
    var pre = userData['suman.once.pre.js'];
    var p = pre['create-test-dir'];
    console.log('p =>', p);
    console.error(' => id => ', id);
    var q = new Queue({
        port: 8888,
        fp: path.resolve(p + '/spaceships' + id + '.txt'),
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
    before(function (h) {
        return q.init();
    });
    before(function (h) {
        return q.drain();
    });
    var count = 3;
    before('enqueues without explicit call to subscribe', function (t) {
        var maps = [];
        for (var i = 0; i < count; i++) {
            maps.push(q.enq('charlie'));
        }
        return (_a = Rx.Observable).zip.apply(_a, maps);
        var _a;
    });
    it('assert queue has a size of [count]', function (t) {
        return q.getSize()
            .do(function (data) {
            assert.equal(data.count, count, ' => Count is incorrect.');
        });
    });
});

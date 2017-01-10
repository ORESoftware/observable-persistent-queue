const suman = require('suman');
const Test = suman.init(module, {
    pre: ['create-test-dir']
});


Test.create('backpressure',
    (Queue, Rx, path, fs, before, it, suite, util, userData, after, describe, assert) => {

        const id = suite.uniqueId;
        const pre = userData['suman.once.pre.js'];
        const p = pre['create-test-dir'];

        const q = new Queue({
            port: 3500,
            fp: path.resolve(p + '/spaceships' + id + '.txt')
        });

        before('init queue', h => {
            return q.init()
        });

        const count = 6;

        before('add items to queue', h => {
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


        describe('count after queue', (before, it) => {

            before('drains queue', t => {

                return q.drain({backpressure: true})
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



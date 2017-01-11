'use strict';

const suman = require('suman');
const Test = suman.init(module, {
    pre: ['create-test-dir']
});


Test.create(__filename, {}, function (assert, fs, path, userData, suite, Queue, Rx, before, it) {

    const id = suite.uniqueId;
    const pre = userData['suman.once.pre.js'];
    const p = pre['create-test-dir'];

    console.error('id => ', id);

    const q = new Queue({
        port: 7779,
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

    before(h => {
        return q.drain();
    });

    const count = 3;

    before('enqueues without explicit call to subscribe', t => {

        const maps = [];

        for (let i = 0; i < count; i++) {
            maps.push(q.enq('charlie'));
        }

        return Rx.Observable.zip(...maps);
    });

    // before('enqueues without explicit call to subscribe', t => {
    //
    //     const maps = [];
    //
    //     for (let i = 0; i < count; i++) {
    //         maps.push(q.enq('charlie'));
    //     }
    //
    //     Rx.Observable.timer(100)
    //     //this works!
    //         .subscribe();
    //
    //     Rx.Observable.zip([
    //         // rahhh
    //     ])
    //         .do(function () {   // <<<< here is the problem
    //
    //         });
    // });


    it('assert queue has a size of [count]', t => {

        return q.getSize()
            .do(function (data) {
                console.log('count =>',data.count);
                assert.equal(data.count, count, ' => Count is incorrect.');
            });

    });

});
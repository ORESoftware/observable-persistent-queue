/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');

const Queue = require('../lib/queue');

const q = new Queue({
    filepath: path.resolve(process.env.HOME + '/dogs.txt')
});


process.on('warning', function (w) {
    console.error(w.stack || w);
});

const suman = require('suman');
const Test = suman.init(module);

Test.create('test unique', function (assert) {

    const results = [];

    var subscriptions;

    setTimeout(function () {

        subscriptions = new Array(5).fill().map(function (item, index) {

            const obs = q.dequeueStream();
            obs.resume();
            return obs.subscribe(
                // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
                x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
                e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
                () => console.log('\n', ' => ' + index + ' onCompleted')
            );
        });


    }, 1000);


    const interval = setInterval(function () {

        q.enqueue('jimmy').subscribe(
            x => console.log('\n', ' => dequeue onNext: ', util.inspect(x)),
            e => console.log('\n', ' => dequeue onError: ', e.stack),
            () => console.log('\n', ' => dequeue onCompleted!! ')
        );

    }, 30);

    this.it.cb('test', t => {

        setTimeout(function () {

            clearInterval(interval);
            subscriptions.forEach(function (s) {
                s.dispose();
            });

            const isUnique = results.every(function (item, index) {
                console.log(' => item => ', item);
                return results.indexOf(item) === index;
            });

            try {
                assert(isUnique, ' => Results contains duplicates.');
                t.pass()
            }
            catch (err) {
                t.fail(err);
            }


        }, 5000);

    });


});




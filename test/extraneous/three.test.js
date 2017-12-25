/**
 * Created by oleg on 12/17/16.
 */


const path = require('path');
const util = require('util');
const fs = require('fs');

const Queue = require('../lib/queue');

const q = new Queue({
    port: 7575,
    filepath: path.resolve(process.env.HOME + '/software_testing/dogs.txt')
});


const suman = require('suman');
const Test = suman.init(module);

Test.create('test unique', function (assert) {

    const results = [];

    var subscriptions;

    setTimeout(function () {

        subscriptions = new Array(5).fill().map(function (item, index) {

            const obs = q.eqStream();

            return obs.subscribe(
                // x =>  { x && console.log('\n','1 next: ', util.inspect(x),'\n')},
                x => console.log('\n', ' => ' + index + ' next: ', util.inspect(x), '\n'),
                e => console.log('\n', ' => ' + index + ' error: ', e.stack),
                () => console.log('\n', ' => ' + index + ' completed')
            );
        });


    }, 1000);


    const interval = setInterval(function () {

        q.enqueue('jimmy').subscribe(
            x => console.log('\n', ' => dequeue next: ', util.inspect(x)),
            e => console.log('\n', ' => dequeue error: ', e.stack),
            () => console.log('\n', ' => dequeue completed!! ')
        );

    }, 30);

    this.it.cb('test', t => {

        setTimeout(function () {

            clearInterval(interval);
            subscriptions.forEach(function (s) {
                s.unsubscribe();
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




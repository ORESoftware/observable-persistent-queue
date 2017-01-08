const suman = require('suman');
const Test = suman.init(module, {});


const colors = require('colors/safe');

Test.create(__filename, {}, function (assert, fs, path, Queue, Rx) {

    const q = new Queue({
        port: 8888,
        filepath: path.resolve(process.env.HOME + '/dogs.txt'),
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

    this.before.cb(h => {

        q.init().subscribe(
            function (v) {
                console.log(v);
            },
            function (e) {
                console.error(e);
                h.fail(e);
            },
            function () {
                console.log('complete');
                h.done();
            }
        )

    });

    this.before.cb({timeout: 5000}, h => {

        q.getClient().requestLockInfo(q.getLock(), function (err, data) {

            if (err) {
                return h.fail(err);
            }

            console.log('\n', ' => Locked data after queue init() => ', data, '\n');
            h.done();

        });

    });

    this.before.cb({timeout: 5000}, h => {

        Rx.Observable.interval(10)
            .take(5)
            .flatMap(function (val) {
                return q.enq('foo bar baz', {
                    priority: val
                });
            })
            .reduce(function (prev, curr) {
                return prev.concat(curr);
            }, [])
            .subscribe(
                function (v) {
                    console.log(colors.yellow.bold('next => '), v);
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

    var i = 0;

    this.it.cb('drains queue', {timeout: 6000}, t => {

        const s = Date.now();
        q.drain()
            .subscribe(
                function (v) {
                    console.log(colors.yellow.bold(' next enqueue item => '),'\n', v);
                    setTimeout(function(){
                        v.cb();
                    }, 20);
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


    this.after.cb({timeout: 8000}, h => {


        q.getClient().requestLockInfo(q.getLock(), function (err, data) {

            if (err) {
                return h.fail(err);
            }

            console.log('\n', ' => Locked data before empty => ', data, '\n');

            const s = new Rx.Subject();

            process.nextTick(function () {
                s.next();
            });

            q.isEmpty(s).subscribe(
                function (v) {
                    console.log('v => ', v);
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

                        console.log('\n', ' => Locked data *after* empty => ', data, '\n');
                        h.done();

                    });

                }
            );

        });

    });

});
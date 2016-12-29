/**
 * Created by oleg on 12/27/16.
 */


const q = new Queue();

/*

everytime this.obsEnqueue fires, it does not mean that the dequeueStream() will have an item to send back

so what happens, is that onNext will fire with an undefined/empty value

instead of onNext firing with empty data, I want onNext to fire *only* when a value is actually available

thus, I need to "cancel" the observable from the producer side, because only the producer knows whether the
data exists or not.

*/

// !!!
// we have five observers, imagine only 1 item gets added to the queue, then only ONE onNext will have data,
// the other 4 will have empty data!

 q.dequeueStream().subscribe(
    // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
    x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
    e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
    () => console.log('\n', ' => ' + index + ' onCompleted')
);

 q.dequeueStream().subscribe(
    // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
    x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
    e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
    () => console.log('\n', ' => ' + index + ' onCompleted')
);

q.dequeueStream().subscribe(
    // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
    x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
    e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
    () => console.log('\n', ' => ' + index + ' onCompleted')
);

q.dequeueStream().subscribe(
    // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
    x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
    e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
    () => console.log('\n', ' => ' + index + ' onCompleted')
);

q.dequeueStream().subscribe(
    // x =>  { x && console.log('\n','1 onNext: ', util.inspect(x),'\n')},
    x => console.log('\n', ' => ' + index + ' onNext: ', util.inspect(x), '\n'),
    e => console.log('\n', ' => ' + index + ' onError: ', e.stack),
    () => console.log('\n', ' => ' + index + ' onCompleted')
);


//http://chat.stackoverflow.com/rooms/131652/rx
//https://jsfiddle.net/p3dxtvsL/


function Queue() {

    let index = 0;

    let queue = new Rx.Subject();

    let queueStream = Rx.Observable.create(obs => {
        var push = Rx.Observer.create(v => {
            if(index % queue.observers.length == queue.observers.indexOf(push)){
                obs.onNext(v);
            }
        });
        return queue.subscribe(push);
    });

    this.push = (v) => { queue.onNext(v); index++; };
    this.read = () => queueStream;
}

log = console.log.bind(console);
queue = new Queue();

queue.read().subscribe(v => log(1, v));
queue.read().subscribe(v => log(2, v));

queue.push(1);
queue.push(2);
queue.push(3);
queue.push(4);
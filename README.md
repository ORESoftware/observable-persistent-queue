

##     OPQ  (Observable Persistent Queue)

This project was borne of the necessity to create a local message queue usable by NPM libraries, especially
during NPM postinstall routines. NPM install commands should not happen in parallel, so we need a queue of some variety.
Not only that, the queue needs to be persistent and shared, such that if npm install commands happen in parallel and are 
requested via multiple processes, that this information can be shared in one place.

* <b>Observable</b> => Using RxJS, we observe queue for changes and react accordingly; RxJS allows for creating highly composable and flexible APIs.
* <b>Persistent</b> => The queue is on the filesystem, and can be read + written to via multiple processes
* <b>Queue</b> => standard FIFO queue, in this case, lines in a text file, separated by newline chars; however, you can 
create priority requests and pull items off the queue in any order you wish based on custom searches/queries.

# Disclaimer

This library is in beta; not all features mentioned are working as described.
Because the lock/unlock cycle takes about 3 ms, and other code needs to execute as well, the queue will
grow unboundedly if items are added to the queue faster than every 25 ms. Unfortunately adding more readers 
in different processes probably will not help drain the queue, because locking/unlocking is still a bottleneck,
and the more lock/unlock requestors the slower it is for everyone to read from the queue. This library
 will delay adding new items to the queue if the number of requests waiting for a lock is greater than a certain 
 number.

# Design

This library uses live-mutex for locking to control read/write access to the queue and prevent corruption.
This is slower but much more robust than file locking (with the NPM lockfile library or similar). As stated, this 
library uses RxJS, specifically RxJS5.


# Installation

###  <i>``` npm install --save observable-persistent-queue```</i>

# Usage / API

### initializing a queue

If the file already exists on the filesystem - no problem, that is expected, and we will use that as the queue.
If the file does *not* exist, we will create the new empty file (or with initial data). OPQ will also manage port conflicts, if there is already
a live-mutex broker listening on port 8888, then we will use that broker. You will need to pass in a different port
if you don't want to use the existing broker.

```js

const path = require('path');
const OPQ = require('observable-persistent-queue');

const q = new OPQ({
     port: 8888,
     priority: 5,  // 5 different priority levels, 1,2,3,4,5
     initialData: [],
     filePath: path.resolve(process.env.HOME, 'queue.txt')
});

// enqueue a message to be placed onto the queue
q.enq('some message to put on the queue');
 // dequeue 1 (or zero) items from the queue
q.deq();

// but wait, this is node.js, where is the callback? Here we go:
q.enq('some message').subscribe(function next(result){})
q.deq().subscribe(function next(result){}); 

// for the enq() and deq() methods, you do not need to call subscribe to initiate the action
// but you will need to call subscribe to see/use the results.

```

### advanced calls

Note that unless a fairly fatal error happens, errors will be passed to the next callback like so:

```js
q.deq().subscribe(function next(result){
    if(result.error){
        
    }
}); 

```
This is because using error and the error handler will break subscripton flows. We will only
break that flow when it's appropriate, which it is mostly not.


```js

// enqueue multiple items in one call, you can only enqueue stringified data, otherwise an error will be thrown
q.enq(['a','b','c','d'], {
    priority: 3
});

// batch items so that they are all processed together
q.enq(['a','b','c','d'], {
    priority: 3,
    batch: true
});

// the above is the same as:
q.enqBatch(['a','b','c','d'], {
    priority: 3
});

// dequeue 5 items from the queue, if only 3 exist, then 3 will be returned, if only 2 exist, then an error will be 
// immediately passed back

q.deq({
    min: 3,
    count: 5
});

// most likely, you will want to get the resulting data from dequeue calls; use subscribe
q.deq({
    min: 3,
    count: 5
})
.subscribe(function next(data){
    
});

// wait until at least 3 items are available, an error will *not* be raised if 3 items are not available immediately
q.deq({
    wait: true,
    min: 3,  // if min is not supplied, min will be 5
    count: 5
});

// dequeue items that match a pattern
q.deq({
    pattern: /abc/,
    min: 3,
    count: 5
});

// dequeue items that are older or younger than a date
q.deq({
    youngerThan: new Date(),
    olderThan: Date.parse(),//,
    min: 3,
    count: 5
});


```



## cleaning up when you're done

### TBD




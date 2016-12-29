

# OPQ => Observable Persistent Queue


This project was borne of the necessity to create a local message queue usable by NPM libraries, especially
during NPM postinstall routines. NPM install commands should not happen in parallel, so we need a queue of some variety.
Not only that, the queue needs to be persistent and shared, such that if npm install commands happen in parallel and are 
requested via multiple processes, that this information can be shared in one place.


# Installation

``` npm install --save observable-persistent-queue```

# Usage / API

### initializing a queue

note: if the file already exists on the filesystem - no problem, that is expected, and we will use that as the queue.
if the file does not exist, we will create a new empty file. OPQ will also manage port conflicts, if there is already
a live-mutex broker listening on port 8888, then we will use that broker. You will need to pass in a different port
if you don't want to use the existing broker.

```js

const path = require('path');
const OPQ = require('observable-persistent-queue');

const q = new OPQ({
     port: 8888,
     filePath: path.resolve(process.env.HOME, 'queue.txt')
});

q.enq('some message to put on the queue');
q.deq(); // dequeue 1 (or zero) items from the queue

```

# advanced calls

```js

// enqueue multiple items in one call, you can only enqueue stringified data, otherwise an error will be thrown
q.enq(['a','b','c','d', {
    
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
.subscribe(function onNext(data){
    
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


```


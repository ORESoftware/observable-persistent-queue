/**
 * Created by oleg on 12/23/16.
 */


module.exports = {

    lock: function (file, opts, fn) {
        if(typeof opts === 'function'){
            fn = opts;
            opts = {};
        }
        const to = 1000 *Math.random();
        setTimeout(fn, to);
    },

    unlock: function (path, fn) {
         process.nextTick(fn);
    }

};
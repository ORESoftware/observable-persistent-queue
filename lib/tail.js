/**
 * Created by oleg on 12/24/16.
 */



const cp = require('child_process');


module.exports = function(file){

    const n = cp.spawn('tail',['-f',file]);

    n.on('error', function(err){
        console.error(err.stack || err);
    });

    return n.stdout;


};
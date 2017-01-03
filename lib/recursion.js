/**
 * Created by oleg on 12/31/16.
 */





function p() {
    return new Promise(function (r) {
        process.nextTick(r);
    })
}


function recurse(count) {

    return p().then(function () {
        if (count < 10) {
            console.log('count => ', count);
            return recurse(++count);
        }
    }).then(function(){
        console.log('a');
        return 5;
    });

}


recurse(1).then(function () {
    console.log('done');
});
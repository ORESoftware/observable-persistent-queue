module.exports = data => {
    return {
        Rx: function () {
            return require('rxjs');
        },
        Queue: function () {
            return require('../../lib/queue').Queue;
        }
    };
};

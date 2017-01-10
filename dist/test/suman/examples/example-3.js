var suman = require('suman');
var Test = suman.init(module, {});
Test.describe(__filename, function (assert) {
    this.before(function (t) {
        console.log('before');
    });
    this.it(function (t) {
        assert(true);
    });
    this.after(function (t) {
        console.log('after');
    });
});

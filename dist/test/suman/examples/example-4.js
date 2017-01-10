var suman = require('suman');
var Test = suman.init(module, {});
Test.describe(__filename, function (assert, child_process) {
    this.before(function (t) {
        console.log('before');
    });
    this.it(function (t) {
        assert(true);
    });
    this.it(function (t) {
        assert(true);
    });
    this.describe('nested describe block', function () {
        this.beforeEach(function (t) {
            console.log('beforeEach hook should only run once');
        });
        this.it(function (t) {
            assert(true);
        });
    });
    this.after(function (t) {
        console.log('after');
    });
});

var suman = require('suman');
var Test = suman.init(module);
Test.describe('SimpleTest', function (assert, fs, http, os) {
    this.beforeEach(function (t) {
        t.data.num = ++t.value;
    });
    this.it('is six', { value: 5 }, function (t) {
        assert.equal(t.data.num, t.value + 1);
    });
    this.it('is nine', { value: 8 }, function (t) {
        assert.equal(t.data.num, t.value + 1);
    });
});

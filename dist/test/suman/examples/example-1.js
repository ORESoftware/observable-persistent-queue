var suman = require('suman');
var Test = suman.init(module);
Test.describe('SimpleTest', function (assert, fs, http, os) {
    var _this = this;
    this.it('tests-arrays', function (t) {
        assert.equal(typeof [], 'object');
    });
    ['describe', 'it', 'before', 'beforeEach', 'after', 'afterEach'].forEach(function (item) {
        _this.it('tests-suman suite block for: ' + item, function (t) {
            assert(_this.hasOwnProperty(item));
        });
    });
    this.it('Check that Test.file is equiv. to module.filename', { timeout: 20 }, function (t) {
        setTimeout(function () {
            assert(module.filename === Test.file);
            t.done();
        }, 19);
    });
    this.it.cb('reads this file, pipes to /dev/null', function (t) {
        var destFile = os.hostname === 'win32' ? process.env.USERPROFILE + '/temp' : '/dev/null';
        fs.createReadStream(Test.file).pipe(fs.createWriteStream(destFile))
            .on('error', t.fail).on('finish', t.pass);
    });
    this.it('uses promises to handle http', { timeout: 4000 }, function () {
        return new Promise(function (resolve, reject) {
            var req = http.request({
                method: 'GET',
                hostname: 'example.com'
            }, function (res) {
                var data = '';
                res.on('data', function (d) {
                    data += d;
                });
                res.on('end', function () {
                    assert(typeof data === 'string');
                    resolve();
                });
            });
            req.end();
            req.on('error', reject);
        });
    });
});

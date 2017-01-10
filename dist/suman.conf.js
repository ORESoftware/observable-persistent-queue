var os = require('os');
var path = require('path');
var numOfCPUs = os.cpus().length || 1;
module.exports = Object.freeze({
    matchAny: [],
    matchNone: [/fixture/, /.*target/],
    matchAll: [/\.test\.js$/],
    testDir: 'dist/test',
    testSrcDir: 'dist/test/test-src',
    testTargetDir: 'dist/test/test-target',
    sumanHelpersDir: 'dist/test/suman',
    uniqueAppName: '<your-app-name-here>',
    browser: 'Firefox',
    errorsOnly: false,
    replayErrorsAtRunnerEnd: true,
    allowArrowFunctionsForTestBlocks: true,
    alwaysUseRunner: false,
    enforceGlobalInstallationOnly: false,
    enforceLocalInstallationOnly: false,
    sourceTopLevelDepsInPackageDotJSON: false,
    enforceTestCaseNames: true,
    enforceBlockNames: true,
    enforceHookNames: false,
    bail: true,
    bailRunner: true,
    transpile: false,
    executeRunnerCWDAtTestFile: true,
    sendStderrToSumanErrLogOnly: true,
    useSuiteNameInTestCaseOutput: false,
    ultraSafe: false,
    verbose: true,
    checkMemoryUsage: false,
    fullStackTraces: false,
    disableAutoOpen: false,
    suppressRunnerOutput: true,
    allowCollectUsageStats: true,
    verbosity: 5,
    maxParallelProcesses: Math.max(6, numOfCPUs),
    resultsCapCount: 100,
    resultsCapSize: 7000,
    defaultHookTimeout: 5000,
    defaultTestCaseTimeout: 5000,
    timeoutToSearchForAvailServer: 2000,
    defaultDelayFunctionTimeout: 8000,
    defaultChildProcessTimeout: 8000000,
    defaultTestSuiteTimeout: 15000,
    expireResultsAfter: 10000000,
    coverage: {
        nyc: {
            use: false,
        },
        istanbul: {}
    },
    watch: {
        '//tests': {
            'default': {
                script: function (p) {
                    return "./node_modules/.bin/suman " + p;
                },
                include: [],
                exclude: ['^test.*']
            }
        },
        '//project': {
            'default': {
                script: './node_modules/.bin/suman',
                include: [],
                exclude: ['^test.*']
            }
        },
    },
    reporters: {
        'tap': 'suman/reporters/tap'
    },
    servers: {
        '*default': {
            host: '127.0.0.1',
            port: 6969
        },
        '###': {
            host: '127.0.0.1',
            port: 6969
        },
    },
    useBabelRegister: false,
    babelRegisterOpts: {
        ignore: /fixture/,
        extensions: ['.es6', '.es', '.jsx', '.js']
    }
});

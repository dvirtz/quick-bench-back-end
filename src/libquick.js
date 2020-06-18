var exec = require('child_process').exec;
var sha1 = require('sha1');
var fs = require('fs');
const tools = require('./tools');

const MAX_CODE_LENGTH = 20000;

const WRITE_PATH = '/data';
const PREFIX_CODE_1 = `#include <benchmark/benchmark_api.h>
`;
const SUFFIX_CODE_1 = `

static void Noop(benchmark::State& state) {
  while (state.KeepRunning());
}
BENCHMARK(Noop);
BENCHMARK_MAIN()`;
const PREFIX_CODE_2 = `#include <benchmark/benchmark.h>
`;
const SUFFIX_CODE_2 = `

static void Noop(benchmark::State& state) {
  for (auto _ : state) benchmark::DoNotOptimize(0);
}
BENCHMARK(Noop);
BENCHMARK_MAIN()`;
const SUFFIX_CODE_3 = `

static void Noop(benchmark::State& state) {
  for (auto _ : state) benchmark::DoNotOptimize(0);
}
BENCHMARK(Noop);
BENCHMARK_MAIN();`;

function runDockerCommand(fileName, request) {
    return './run-docker ' + fileName + ' ' + request.options.compiler + ' ' + request.options.optim + ' ' + request.options.cppVersion + ' ' + (request.isAnnotated || false) + ' ' + (request.force || false) + ' ' + (request.options.lib || 'gnu');
}

function optionsToString(request) {
    let options = {
        protocolVersion: request.protocolVersion,
        isAnnotated: request.isAnnotated,
        options: {
            compiler: request.options.compiler,
            optim: request.options.optim,
            cppVersion: request.options.cppVersion,
            lib: request.options.lib
        }
    };
    return JSON.stringify(options);
}

function execute(fileName, request) {
    let options = {
        timeout: 60000,
        killSignal: 'SIGKILL'
    };
    return new Promise((resolve, reject) => {
        console.time(fileName);
        return exec(runDockerCommand(fileName, request), options, function (err, stdout, stderr) {
            if (err) {
                console.timeEnd(fileName);
                console.log('Bench failed ' + fileName);
                exec("./kill-docker " + fileName);
                reject("\u001b[0m\u001b[0;1;31mError or timeout\u001b[0m\u001b[1m<br>" + stdout + "<br>" + stderr);
            } else {
                console.timeEnd(fileName);
                console.log('Bench done ' + fileName + (stderr.indexOf('cached results') > -1 ? ' from cache' : ''));
                resolve({
                    res: fs.readFileSync(fileName + '.out'),
                    stdout: stderr,
                    id: tools.encodeName(makeName(request)),
                    annotation: request.isAnnotated ? fs.readFileSync(fileName + '.perf', 'utf8') : null
                });
            }
        });
    });
}

function groupResults(results) {
    let code = unwrapCode(results[0]);
    let options = results[1];
    let graph = results[2];
    let annotation = results[3];
    return { code: code, options: JSON.parse(options), graph: JSON.parse(graph), annotation: annotation };
}

function makeName(request) {
    if (request.protocolVersion === 1)
        return sha1(request.code + request.compiler + request.optim + request.cppVersion + request.protocolVersion);
    else if (request.protocolVersion === 2)
        return sha1(request.code + request.compiler + request.optim + request.cppVersion + request.isAnnotated + request.protocolVersion);
    else if (request.protocolVersion === 3)
        return sha1(request.code + request.compiler + request.optim + request.cppVersion + request.isAnnotated + request.protocolVersion + request.lib);
    return sha1(request.code + request.options.compiler + request.options.optim + request.options.cppVersion + request.isAnnotated + request.protocolVersion + request.options.lib);
}

function wrapCode(inputCode) {
    return PREFIX_CODE_2 + inputCode + SUFFIX_CODE_3;
}

function unwrapCode(inputCode) {
    if (inputCode.startsWith(PREFIX_CODE_1)) {
        inputCode = inputCode.slice(PREFIX_CODE_1.length);
    }
    if (inputCode.endsWith(SUFFIX_CODE_1)) {
        inputCode = inputCode.slice(0, -SUFFIX_CODE_1.length);
    }
    if (inputCode.startsWith(PREFIX_CODE_2)) {
        inputCode = inputCode.slice(PREFIX_CODE_2.length);
    }
    if (inputCode.endsWith(SUFFIX_CODE_2)) {
        inputCode = inputCode.slice(0, -SUFFIX_CODE_2.length);
    }
    if (inputCode.endsWith(SUFFIX_CODE_3)) {
        inputCode = inputCode.slice(0, -SUFFIX_CODE_3.length);
    }
    return inputCode;
}

function getFunctions(code) {
    RE = /BENCHMARK\s*\(\s*([A-Za-z0-9_]+)\s*\)/g;
    let content = '';
    let res;
    while ((res = RE.exec(code)) !== null) {
        content += res[1] + '\n';
    }
    return content;
}

async function benchmark(request, header) {
    try {
        if (request.code.length > MAX_CODE_LENGTH) {
            return Promise.reject('\u001b[0m\u001b[0;1;31mError: Unauthorized code length.\u001b[0m\u001b[1m');
        }
        let name = makeName(request);
        console.log('Bench ' + name + ' ' + JSON.stringify(header) + ' < ' + optionsToString(request));
        var dir = WRITE_PATH + '/' + name.substr(0, 2);
        var fileName = dir + '/' + name;
        await tools.write(fileName + '.cpp', wrapCode(request.code));
        await tools.write(fileName + '.func', getFunctions(request.code));
        await tools.write(fileName + '.opt', optionsToString(request));
        return await execute(fileName, request);
    } catch (e) {
        return { stdout: e };
    }
}

async function reload(encodedName) {
    let name = tools.decodeName(encodedName);
    var dir = WRITE_PATH + '/' + name.substr(0, 2);
    var fileName = dir + '/' + name;
    let values = await Promise.all([tools.read(fileName + '.cpp'), tools.read(fileName + '.opt'), tools.read(fileName + '.out'), tools.read(fileName + '.perf', true)])
    return groupResults(values);
}

function makeGraphResult(values, message, id, annotation) {
    let result = {};
    if (values) {
        result = { context: values.context };
        const noopTime = values.benchmarks[values.benchmarks.length - 1].cpu_time;
        result.benchmarks = values.benchmarks.map(obj => {
            return {
                name: obj.name,
                cpu_time: obj.cpu_time / noopTime
            };
        });
    }
    return { result: result, message: message, id: id, annotation: annotation };
}

function makeRequest(done) {
    return {
        code: done.code,
        compiler: done.options.compiler,
        optim: done.options.optim,
        cppVersion: done.options.cppVersion,
        isAnnotated: done.options.isAnnotated,
        lib: done.options.lib,
        protocolVersion: done.options.protocolVersion
    };
}
function getRequestAndResult(done) {
    const request = makeRequest(done);
    return Object.assign({ tab: request }, makeGraphResult(done.graph, '', tools.encodeName(makeName(request)), done.annotation));
}

exports.makeName = makeName;
exports.wrapCode = wrapCode;
exports.unwrapCode = unwrapCode;
exports.groupResults = groupResults;
exports.getFunctions = getFunctions;
exports.optionsToString = optionsToString;
exports.execute = execute;
exports.benchmark = benchmark;
exports.makeGraphResult = makeGraphResult;
exports.reload = reload;
exports.getRequestAndResult = getRequestAndResult;

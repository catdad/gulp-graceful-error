/* jshint node: true, mocha: true */

var fs = require('fs');
var vm = require('vm');
var stream = require('stream');

var expect = require('chai').expect;
var through = require('through2');
var unstyle = require('unstyle');

var libFilename = require.resolve('../');
var libFile = fs.readFileSync(libFilename).toString();
var lib = require(libFilename);

// allow hijacking IO, so that we can both
// test values and not log during a test
var fakeIo = (function () {

  var originalStdout;
  var originalStderr;

  var outData = [];
  var errData = [];

  function collect(arr) {
    return function (val) {
      arr.push(new Buffer(val));
    };
  }

  return {
    activate: function () {
      originalStdout = process.stdout.write;
      originalStderr = process.stderr.write;

      process.stdout.write = collect(outData);
      process.stderr.write = collect(errData);
    },
    deactivate: function () {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;

      var data = {
        stdout: Buffer.concat(outData).toString(),
        stderr: Buffer.concat(errData).toString()
      };

      outData = [];
      errData = [];

      return data;
    }
  };
})();

function getLibInVm(proc) {
  var start = '(function (exports, require, module, process) {';
  var end = '})';
  var code = start + libFile.trim() + end;

  var fakeProcess = Object.defineProperty({}, 'exitCode', {
    configurable: false,
    get: function () {
      return;
    },
    set: function (val) {
      proc.exitCode = val;
    }
  });

  var mod = {
    exports: {}
  };

  vm.runInThisContext(code, {
    filename: libFilename,
    columnOffset: start.length
  })(mod.exports, require, mod, fakeProcess);

  return mod.exports;
}

describe('[index]', function () {
  it('is a function', function () {
    expect(lib).to.be.a('function');
  });

  it('returns a stream', function () {
    var out = lib();

    // test that it is stream-like...
    expect(out).to.be.instanceof(stream);
    expect(out).to.have.property('pipe').and.to.be.a('function');
    expect(out).to.have.property('on').and.to.be.a('function');
    expect(out).to.have.property('emit').and.to.be.a('function');
  });

  it('wraps a stream that is piped in', function () {
    var stream = through();

    var originalPipe = stream.pipe;
    var originalEmit = stream.emit;

    var wrapped = lib().pipe(stream);

    expect(wrapped)
      .to.have.a.property('pipe')
      .and.to.be.a('function')
      .and.to.not.equal(originalPipe);
    expect(wrapped)
      .to.have.a.property('emit')
      .and.to.be.a('function')
      .and.to.not.equal(originalEmit);
  });

  it('throws an error if a non-stream is piped in', function () {
    expect(function () {
      lib().pipe('not a stream');
    }).to.throw(TypeError, 'parameter must be a stream');
  });

  it('passes through events that are emitted on the stream', function (done) {
    var stream = lib();

    stream.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes through events that are emitted on a stream that is piped in', function (done) {
    var stream = through();
    var wrapped = lib().pipe(stream);

    wrapped.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes errors by default', function (done) {
    var ERR = new Error('pineapple error');

    var stream = lib();

    stream.on('error', function (err, arg1) {
      expect(err).to.equal(ERR);
      expect(arg1).to.equal(1);

      done();
    });

    stream.emit('error', ERR, 1);
  });

  it('passes errors by default on streams that are piped in', function (done) {
    var ERR = new Error('pineapple error');

    var stream = through();
    var wrapped = lib().pipe(stream);

    wrapped.on('error', function (err, arg1) {
      expect(err).to.equal(ERR);
      expect(arg1).to.equal(1);

      done();
    });

    stream.emit('error', ERR, 1);
  });

  it('sets process.exitCode when an error is encountered in graceful mode', function (done) {

    fakeIo.activate();

    var proc = {};
    var ERR = new Error('pineapples');
    var stream = through();
    var mod = getLibInVm(proc);

    var out = mod().pipe(stream);

    out.graceful();

    out.on('end', function () {
      expect(proc).to.have.property('exitCode').to.equal(1);

      var ioData = fakeIo.deactivate();

      expect(ioData.stdout).to.have.length.above(0);
      expect(ioData.stderr).to.have.lengthOf(0);

      var stdout = unstyle.string(ioData.stdout);

      // test that the original output was in color
      expect(ioData.stdout).to.not.equal(stdout);

      // test that the content is expected
      expect(stdout)
        .to.match(/Error in plugin 'graceful-gulp'/)
        .and.to.match(/pineapples/);

      done();
    });

    out.emit('error', ERR);
  });

  it('graceful can be overwriten by passing in a boolean to the function');
});

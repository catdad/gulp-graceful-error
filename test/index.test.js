/* jshint node: true, mocha: true */

var fs = require('fs');
var vm = require('vm');
var stream = require('stream');

var expect = require('chai').expect;
var through = require('through2');
var unstyle = require('unstyle');

// Only run tests entirely thorugh the vm when
// running the npm coverage script. Otherwise,
// run the code directly.
var CONFUSING_COVERAGE = !!(
  process.env.npm_lifecycle_event &&
  process.env.npm_lifecycle_event === 'coverage'
);

var vmProcess = {};

var mod = {
  filename: require.resolve('../')
};

mod.file = fs.readFileSync(mod.filename).toString();

Object.defineProperty(mod, 'lib', {
  enumerable: true,
  configurable: false,
  get: function () {
    if (CONFUSING_COVERAGE) {
      // run all tests through the vm
      return getLibInVm(vmProcess);
    }

    // run non-vm tests outside of the vm
    return require(mod.filename);
  }
});

// allow hijacking IO, so that we can both
// test values and not log during a test
var fakeIo = (function () {

  var originalStdout = process.stdout.write;
  var originalStderr = process.stderr.write;

  var outData = [];
  var errData = [];

  function collect(arr) {
    return function (val) {
      arr.push(new Buffer(val));
    };
  }

  return {
    activate: function () {
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
  var code = start + mod.file.trim() + end;

  var fakeProcess = Object.defineProperty({}, 'exitCode', {
    configurable: false,
    get: function () {
      return;
    },
    set: function (val) {
      proc.exitCode = val;
    }
  });

  var vmModule = {
    exports: {}
  };

  var vmOpts = CONFUSING_COVERAGE ?
    // this is wrong, but is the API that istanbul uses
    mod.filename :
    // this is the correct node API, but breaks istanbul coverage
    {
      filename: mod.filename,
      columnOffset: start.length
    };

  vm.runInThisContext(code, vmOpts)(vmModule.exports, require, vmModule, fakeProcess);

  return vmModule.exports;
}

function expectStream(obj) {
  expect(obj).to.be.instanceof(stream);
  expect(obj).to.have.property('pipe').and.to.be.a('function');
  expect(obj).to.have.property('on').and.to.be.a('function');
  expect(obj).to.have.property('emit').and.to.be.a('function');
}

function expectThroughObjectStream(obj) {
  expectStream(obj);

  expect(obj)
    .to.have.property('_readableState')
    .and.to.have.property('objectMode')
    .and.to.equal(true);

  expect(obj)
    .to.have.property('_writableState')
    .and.to.have.property('objectMode')
    .and.to.equal(true);
}

function expectGracefulStream(obj) {
  expectStream(obj);

  expect(obj).to.have.property('graceful').and.to.be.a('function');
}

describe('[index]', function () {
  beforeEach(function () {
    vmProcess = {};
  });

  it('is a function', function () {
    expect(mod.lib).to.be.a('function');
  });

  it('returns a transform object stream', function () {
    var out = mod.lib();

    // uses object streams by default
    expectThroughObjectStream(out);
    expectGracefulStream(out);
  });

  it('wraps a stream that is piped in', function () {
    var stream = through();

    var originalPipe = stream.pipe;
    var originalEmit = stream.emit;

    var wrapped = mod.lib().pipe(stream);

    expect(wrapped)
      .to.have.a.property('pipe')
      .and.to.be.a('function')
      .and.to.not.equal(originalPipe);

    expect(wrapped)
      .to.have.a.property('emit')
      .and.to.be.a('function')
      .and.to.not.equal(originalEmit);

    expectStream(wrapped);
    expectGracefulStream(wrapped);
  });

  it('throws an error if a non-stream is piped in', function () {
    expect(function () {
      mod.lib().pipe('not a stream');
    }).to.throw(TypeError, 'parameter must be a stream');
  });

  it('passes through events that are emitted on the stream', function (done) {
    var stream = mod.lib();

    stream.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes through events that are emitted on a stream that is piped in', function (done) {
    var stream = through();
    var wrapped = mod.lib().pipe(stream);

    wrapped.on('pineapples', function (arg1, arg2) {
      expect(arg1).to.equal(1);
      expect(arg2).to.equal(2);

      done();
    });

    stream.emit('pineapples', 1, 2);
  });

  it('passes errors by default', function (done) {
    var ERR = new Error('pineapple error');

    var stream = mod.lib();

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
    var wrapped = mod.lib().pipe(stream);

    wrapped.on('error', function (err, arg1) {
      expect(err).to.equal(ERR);
      expect(arg1).to.equal(1);

      done();
    });

    stream.emit('error', ERR, 1);
  });

  it('returns the piped in stream from the pipe method', function () {
    var stream = through();

    var returnValue = mod.lib().pipe(stream);

    expect(returnValue).to.equal(stream);
  });

  describe('#graceful', function () {
    it('can be chained from the graceful method', function () {
      var stream = mod.lib();

      var returnValue = stream.graceful();

      expect(returnValue).to.equal(stream);
    });

    it('can be chained from the graceful method of a piped-in stream', function () {
      var stream = through();

      var returnValue = mod.lib().pipe(stream).graceful();

      expect(returnValue).to.equal(stream);
    });

    it('sets process.exitCode when an error is encountered in graceful mode', function (done) {
      fakeIo.activate();

      var proc = {};
      var ERR = new Error('pineapples');
      var stream = through();
      var vmMod = getLibInVm(proc);

      var wrapped = vmMod().pipe(stream);

      wrapped.graceful();

      wrapped.on('end', function () {
        expect(proc).to.have.property('exitCode').to.equal(1);

        var ioData = fakeIo.deactivate();

        expect(ioData.stdout).to.have.length.above(0);
        expect(ioData.stderr).to.have.lengthOf(0);

        var stdout = unstyle.string(ioData.stdout);

        // test that the original output was in color
        expect(ioData.stdout).to.not.equal(stdout);

        // test that the content is expected
        expect(stdout)
          .to.match(/Error in plugin ('|")graceful-gulp('|")/)
          .and.to.match(new RegExp(ERR.message));

        done();
      });

      stream.emit('error', ERR);
    });

    it('silently handled any error after the first in graceful mode', function (done) {
      fakeIo.activate();

      var stream = through();
      var vmMod = getLibInVm(vmProcess);

      var wrapped = vmMod().pipe(stream);

      wrapped.graceful();

      wrapped.on('end', function () {
        var ioData = fakeIo.deactivate();

        expect(ioData.stdout).to.have.length.above(0);
        expect(ioData.stderr).to.have.lengthOf(0);

        var stdout = unstyle.string(ioData.stdout);

        expect(stdout).to.match(/invalid non-string\/buffer chunk/i);

        done();
      });

      stream.write(42);
      stream.write(43);
      stream.write(44);
    });

    it('can be override graceful mode by passing in a boolean to the graceful function', function (done) {
      var ERR = new Error('pineapples');
      var stream = through();
      var wrapped = mod.lib().pipe(stream);

      wrapped.graceful();
      wrapped.graceful(false);

      wrapped.on('error', function (err) {
        expect(err).to.equal(ERR);

        done();
      });

      stream.emit('error', ERR);
    });
  });

});

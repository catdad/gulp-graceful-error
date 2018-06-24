/* jshint node: true */

var fs = require('fs');
var vm = require('vm');
var stream = require('stream');

var expect = require('chai').expect;
var unstyle = require('unstyle');

// Only run tests entirely thorugh the vm when
// running the npm coverage script. Otherwise,
// run the code directly.
var CONFUSING_COVERAGE = !!(
  process.env.npm_lifecycle_event &&
  process.env.npm_lifecycle_event === 'coverage'
);

var IO_ERR_REGEX = /Error in plugin ('|")graceful-gulp('|")/;

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
      return getLibInVm();
    }

    // run non-vm tests outside of the vm
    return require(mod.filename);
  }
});

Object.defineProperty(mod, 'inVm', {
  enumerable: true,
  configurable: false,
  writable: false,
  value: function (processObj) {
    return getLibInVm(processObj);
  }
});

function getLibInVm(processObj) {
  var proc = processObj || {};
  var start = '(function (exports, require, module, process) {';
  var end = '})';
  var code = start + mod.file.trim() + end;

  var vmModule = {
    exports: {}
  };

  var vmProcess = Object.defineProperty({}, 'exitCode', {
    configurable: false,
    get: function () {
      return;
    },
    set: function (val) {
      proc.exitCode = val;
    }
  });

  var vmOpts = CONFUSING_COVERAGE ?
    // this is wrong, but is the API that istanbul uses
    mod.filename :
    // this is the correct node API, but breaks istanbul coverage
    {
      filename: mod.filename,
      columnOffset: start.length
    };

  vm.runInThisContext(code, vmOpts)(vmModule.exports, require, vmModule, vmProcess);

  return vmModule.exports;
}

function expectIoError(io, err) {
  expect(io.stdout).to.have.length.above(0);
  expect(io.stderr).to.have.lengthOf(0);

  var stdout = unstyle.string(io.stdout);

  // test that the content is expected
  expect(stdout)
    .to.match(IO_ERR_REGEX)
    .and.to.match(new RegExp(err.message));

  // test that the original output was in color
  expect(io.stdout).to.not.equal(stdout);
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

module.exports = {
  mod: mod,
  getLibInVm: getLibInVm,
  expectIoError: expectIoError,
  expectStream: expectStream,
  expectThroughObjectStream: expectThroughObjectStream,
  expectGracefulStream: expectGracefulStream
};

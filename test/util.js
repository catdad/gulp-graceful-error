/* jshint node: true */

var fs = require('fs');
var vm = require('vm');

// Only run tests entirely thorugh the vm when
// running the npm coverage script. Otherwise,
// run the code directly.
var CONFUSING_COVERAGE = !!(
  process.env.npm_lifecycle_event &&
  process.env.npm_lifecycle_event === 'coverage'
);

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

module.exports = {
  mod: mod,
  getLibInVm: getLibInVm
};

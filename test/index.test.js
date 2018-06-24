/* jshint node: true, mocha: true */

var expect = require('chai').expect;

var util = require('./util.js');
var mod = util.mod;

describe('[index]', function () {
  it('is a function', function () {
    expect(mod.lib).to.be.a('function');
  });
});

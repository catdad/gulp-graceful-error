/* jshint node: true, mocha: true */

var stream = require('stream');

var expect = require('chai').expect;
var through = require('through2');

var lib = require('../');

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

  it('wraps a stream that is piped in');

  it('throws an error if a non-stream is piped in');

  it('passes through events that are emitted on the stream');

  it('passes through events that are emitted on a stream that is piped in');

  it('passes errors through by default');

  it('sets process.exitCode when an error is encountered in graceful mode');
});

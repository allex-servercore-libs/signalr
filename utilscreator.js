var Url = require('url');

function createSignalRUtils (lib, mylib) {
  'use strict';

  var q = lib.q,
    qlib = lib.qlib,
    JobBase = qlib.JobBase;

  function UrlParser (url) {
    var urlobj = new URL(url, 'protocol://host/');
    this.searchParams = urlobj.searchParams;
    this.pathelements = urlobj.pathname.split('/');
    this.channel = null;
    this.command = null;
    if (this.isValid()) {
      this.command = this.pathelements[this.pathelements.length-1];
    }
  }
  UrlParser.prototype.destroy = function () {
    this.command = null;
    this.channel = null;
    this.pathelements = null;
    this.searchParams = null;
  };
  UrlParser.prototype.isValid = function () {
    return lib.isArray(this.pathelements) && this.pathelements.length>0;
  };
  UrlParser.prototype.isNegotiate = function () {
    return this.isValid() && this.pathelements[this.pathelements.length-1] == 'negotiate';
  }

  var RecordSeparator = String.fromCharCode(30);
  var TimeConstant = 10*lib.intervals.Second;

  function parseJsonPayload (data) {
    var sprtrpos = data.indexOf(RecordSeparator);
    if (sprtrpos < 0) return null;
    var forparsing = data.substring(0, sprtrpos);
    try {
    return JSON.parse(forparsing);
    }
    catch (e) {
      console.error('JSON parse error on', forparsing, e);
      return null;
    }
  }

  function prettyPayload (str) {
    return str.replace(RecordSeparator, '*');
  }

  function PostHttpRequestReqder (req, defer) {
    JobBase.call(this, defer);
    this.req = req;
    this.dataRead = '';
    this.dataer = this.onData.bind(this);
    this.packer = this.pack.bind(this);
  }
  lib.inherit(PostHttpRequestReqder, JobBase);
  PostHttpRequestReqder.prototype.destroy = function () {
    if (this.req && lib.isFunction(this.req.off)) {
      this.req.off('data', this.dataer);
      this.req.off('end', this.packer);
    }
    this.packer = null;
    this.dataer = null;
    this.dataRead = null;
    this.req = null;
    JobBase.prototype.destroy.call(this);
  };
  PostHttpRequestReqder.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    this.initialHandling();
    return ok.val;
  };
  PostHttpRequestReqder.prototype.initialHandling = function () {
    if (!this.req) {
      this.reject(new lib.Error('NOT_A_HTTP_REQUEST'));
      return;
    }
    if (this.req.method == 'GET') {
      this.resolve(null);
      return;
    }
    this.req.on('data', this.dataer);
    this.req.on('end', this.packer);
  };
  PostHttpRequestReqder.prototype.onData = function (data) {
    this.dataRead += data.toString('utf8');
  };
  PostHttpRequestReqder.prototype.pack = function () {
    this.resolve(this.dataRead);
  };

  mylib.UrlParser = UrlParser;
  mylib.TimeConstant = TimeConstant;
  mylib.RecordSeparator = RecordSeparator;
  mylib.parseJsonPayload = parseJsonPayload;
  mylib.prettyPayload = prettyPayload;
  mylib.PostHttpRequestReqder = PostHttpRequestReqder;
}
module.exports = createSignalRUtils;

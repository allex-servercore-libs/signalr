function createSignalRTransport (lib, mylib) {
  'use strict';

  var Destroyable = lib.Destroyable,
    q = lib.q,
    qlib = lib.qlib;

  //all attaching/detaching will be done by the channel
  function SignalRChannelTransport () {
    Destroyable.call(this);
    this.buffer = new lib.StringBuffer(null, '');
    this.jobs = new qlib.JobCollection();
    this.dataCB = null;
    this.realSenderer = this.realSender.bind(this);
    this.onDrainDoneer = this.onDrainDone.bind(this);
    this.drainerPromise = null;
  }
  lib.inherit(SignalRChannelTransport, Destroyable);
  SignalRChannelTransport.prototype.__cleanUp = function () {
    this.drainerPromise = null;
    this.onDrainDoneer = null;
    this.realSenderer = null;
    this.dataCB = null;
    if (this.jobs) {
      this.jobs.destroy();
    }
    this.jobs = null;
    if (this.buffer) {
      this.buffer.destroy();
    }
    this.buffer = null;
  };
  SignalRChannelTransport.prototype.cleanUp = function () {
    this.dataCB = null;
    if (this.buffer) {
      this.buffer.destroy();
    }
    this.buffer = null;
  };
  SignalRChannelTransport.prototype.remoteAddress = function () {
    throw new lib.Error('NOT_IMPLEMENTED', this.constructor.name+' has to implement remoteAddress()');
  };
  SignalRChannelTransport.prototype.invokeDataCB = function (data) {
    if (!this.dataCB) {
      return q.reject(new lib.Error('NO_DATA_CB_ON_TRANSPORT'));
    }
    return this.onDataCBResult(this.dataCB(data));
  };
  SignalRChannelTransport.prototype.onDataCBResult = function (ret) {
    if (q.isThenable(ret)) {
      return ret.then(this.onDataCBResult.bind(this));
    }
    if (!lib.isVal(ret)) {
      return q(ret);
    }
    if (lib.isString(ret)) {
      return q(ret);
    }
    return q(JSON.stringify(ret));
  };
  SignalRChannelTransport.prototype.send = function (string) {
    if (!this.buffer) {
      return;
    }
    if (!string) {
      return;
    }
    if (!string.endsWith(mylib.RecordSeparator)) {
      string += mylib.RecordSeparator;
    }
    this.buffer.add(string);
    if (!this.canStartDrain()) {
      return;
    }
    this.drainerPromise = this.jobs.run(
      '.', 
      new mylib.StringBufferSender(this, 'buffer', this.realSenderer, this.onDrainDoneer)
    );
  };
  SignalRChannelTransport.prototype.canStartDrain = function () {
    return !this.drainerPromise;
  };
  SignalRChannelTransport.prototype.onDrainDone = function () {
    this.drainerPromise = null;
  };

  mylib.Transport = SignalRChannelTransport;

}
module.exports = createSignalRTransport;

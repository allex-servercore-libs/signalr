function createSignalRChannel(lib, mylib, timerlib) {
  'use strict';

  function SignalRChannel (serverhandler, id) {
    this.serverHandler = serverhandler;
    this.id = id;
    this.transport = null;
    this.remoteAddress = null;
    this.state = null;
    this.msgQ = new lib.StringBuffer(null, null);
    this.serverHandler.channels.add(id, this);
    this.setNewState();
  }
  SignalRChannel.prototype.destroy = function () {
    if (this.serverHandler &&
      this.serverHandler.channels &&
      lib.isFunction(this.serverHandler.channels.remove))
    {
      this.serverHandler.channels.remove(this.id);
    }
    if (this.msgQ) {
      this.msgQ.destroy();
    }
    this.msgQ = null;
    if (this.state) {
      this.state.destroy();
    }
    this.state = null;
    this.remoteaddress = null;
    this.id = null;
    this.serverHandler = null;
  };
  SignalRChannel.prototype.setRemoteAddress = function (remoteaddress) {
    this.remoteAddress = lib.isString(remoteaddress) ? remoteaddress.replace('::ffff:', '') : null;
  }
  SignalRChannel.prototype.destroyTransport = function (transport, skiptimeout) {
    if (transport) {
      transport.cleanUp();
    }
    if (this.transport == transport) {
      this.transport = null;
    }
  };
  SignalRChannel.prototype.attachTransport = function (transport) {
    if (this.transport) {
      this.destroyTransport(this.transport, true);
    }
    if (transport) {
      transport.deathCB = this.destroyTransport.bind(this);
      transport.dataCB = this.ackData.bind(this);
      this.setRemoteAddress(transport.remoteAddress());
    }
    this.transport = transport;
  };
  SignalRChannel.prototype.dumpTo = function (res) {
    if (this.dumperRes) {
      this.dumperRes.end();
    }
    this.dumperRes = res;
    this.recheckForMsgQOnDumper();
    this.ackData(null);
  };
  SignalRChannel.prototype.recheckForMsgQOnDumper = function () {
    if (!this.dumperRes) {
      return;
    }
    if (this.msgQ.hasContents()) {
      new mylib.StringBufferSender(this, 'msgQ', this.writeToDumper.bind(this), this.dumperDone.bind(this)).go();
    }
  };
  SignalRChannel.prototype.writeToDumper = function (string) {
    var defer, ret;
    if (!this.dumperRes) {
      return q.reject(new lib.Error('NO_HTTP_RESPONSE_TO_WRITE_TO'));
    }
    defer = q.defer(), ret = defer.promise;
    console.log('writing', mylib.prettyPayload(string));
    this.dumperRes.write(string, 'utf8', function (err) {
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(true);
      }
      defer = null;
    });
    return ret;
  };
  SignalRChannel.prototype.dumperDone = function () {
    if (this.dumperRes) {
      this.dumperRes.end();
    }
    this.dumperRes = null;
  };
  SignalRChannel.prototype.ackData = function (data) {
    try {
      if (this.state) {
        return this.state.ackData(data);
      }
      throw new lib.Error('NO_STATE_TO_ACK_DATA_ON');
    } catch (e) {
      return q.reject(e);
    }
  };
  SignalRChannel.prototype.send = function (data) {
    var wasempty;
    if (!this.transport) {
      wasempty = !this.msgQ.hasContents();
      this.msgQ.add(data);
      if (wasempty) {
        this.recheckForMsgQOnDumper();
      }
      return;
    }
    this.transport.send(data);
  };
  SignalRChannel.prototype.sendJSON = function (obj) {
    this.send(JSON.stringify(obj) + mylib.RecordSeparator);
  };
  SignalRChannel.prototype.invokeOnClient = function (target) { //varargs
    this.sendJSON({
      type: 1,
      target: target,
      arguments: Array.prototype.slice.call(arguments, 1)
    });
  };
  SignalRChannel.prototype.setNewState = function () {
    var currstate = this.unlinkState();
    var nextstate = currstate ? currstate.nextState(this) : new SignalRChannelInitialState(this);
    this.state = nextstate;
  };
  SignalRChannel.prototype.unlinkState = function () {
    var currstate = this.state;
    if (this.state) {
      this.state.destroy();
    }
    this.state = null;
    return currstate;
  };

  function SignalRChannelState (channel) {
    this.channel = channel;
  }
  SignalRChannelState.prototype.destroy = function () {
    this.channel = null;
  };
  SignalRChannelState.prototype.send = function (data) {
    this.channel.send(data);
  };
  SignalRChannelState.prototype.sendJSON = function (obj) {
    this.channel.sendJSON(obj);
  };
  SignalRChannelState.prototype.ackData = function (data) {
    throw new lib.Error('THIS_METHOD_MUST_BE_OVERLOADED');
  };
  SignalRChannelState.prototype.nextState = function (channel) {
    throw new lib.Error('THIS_METHOD_MUST_BE_OVERLOADED');
  };
  SignalRChannelState.prototype.jsonParse = function (data) {
    return mylib.parseJsonPayload(data);
  };

  function SignalRChannelInitialState (channel) {
    SignalRChannelState.call(this, channel);
  }
  lib.inherit(SignalRChannelInitialState, SignalRChannelState);
  SignalRChannelInitialState.prototype.ackData = function (data) {
    var jsonhandshake = this.jsonParse(data);
    if (jsonhandshake && jsonhandshake.protocol && jsonhandshake.version == 1){
      this.channel.setNewState();
      return {};
    }
  };
  SignalRChannelInitialState.prototype.nextState = function (channel) {
    return new SignalRChannelHandshakenState(channel);
  };

  function SignalRChannelHandshakenState (channel) {
    SignalRChannelState.call(this, channel);
    this.timer = new timerlib.Timer(this.onTimer.bind(this), mylib.TimeConstant, false);
    this.lastTx = Date.now();
    this.lastRx = Date.now();
  }
  lib.inherit(SignalRChannelHandshakenState, SignalRChannelState);
  SignalRChannelHandshakenState.prototype.destroy = function () {
    this.lastTx = null;
    if (this.timer){
      this.timer.destroy();
    }
    this.timer = null;
    SignalRChannelState.prototype.destroy.call(this);
  };
  SignalRChannelHandshakenState.prototype.ackData = function (data) {
    //data might be PackedMessage as well, for now only JSON
    var parsed = this.jsonParse(data);
    if (!parsed) return;
    this.lastRx = Date.now();
    switch (parsed.type) {
      case 1:
        return this.processInvocation(parsed.target, parsed.arguments);
        break;
      case 6: //handled by default with this.lastRx
        break;
      default:
        console.log('already handshaken, not processed', parsed);
        break;
    }
  };
  SignalRChannelHandshakenState.prototype.send = function (data) {
    SignalRChannelState.prototype.send.call(this, data);
    this.lastTx = Date.now();
  };
  SignalRChannelHandshakenState.prototype.onTimer = function () {
    if (Date.now() - this.lastTx >= mylib.TimeConstant) {
      this.sendJSON({type: 6});
    }
    if (Date.now() - this.lastRx >= 2*mylib.TimeConstant) {
      this.channel.destroy();
    }
  };
  SignalRChannelHandshakenState.prototype.processInvocation = function (target, args) {
    return this.channel.serverHandler.clientInvokes(this.channel, target, (lib.isArray(args) && args.length>0) ? args[0] : null);
    //this.channel.needInvocation.fire(this.channel, target, (lib.isArray(args) && args.length>0) ? args[0] : null);
  };

  mylib.Channel = SignalRChannel;
}
module.exports = createSignalRChannel;

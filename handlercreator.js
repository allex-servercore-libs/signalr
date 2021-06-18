var Url = require('url');

function createSignalRServerHandler (lib, mylib) {
  'use strict';

  var WebSocket = lib.ws;

  function SignalRServerHandler (invocationhandler) {
    this.counter = 0;
    this.server = null;
    this.wsserver = null;
    this.handleBound = this.handle.bind(this);
    this.onClientErrorBound = this.onClientError.bind(this);
    this.invocationHandler = invocationhandler;
    this.clearAllBound = this.clearAll.bind(this);
    this.cors = null; //this.cors put here to account for possible outside configuration
    this.channels = new lib.Map();
  }
  SignalRServerHandler.prototype.destroy = function () {
    if (this.channels) {
      lib.containerDestroyAll(this.channels);
      this.channels.destroy();
    }
    this.channels = null;
    this.cors = null;
    this.clearAllBound = null;
    this.invocationhandler = null;
    this.stopHandling();
    this.handleBound = null;
    this.server = null;
  };
  SignalRServerHandler.prototype.closeServer = function () {
    this.stopHandling();
    this.server.close(console.log.bind(console, 'server closed'));
  };
  SignalRServerHandler.prototype.stopHandling = function () {
    if (this.clearAllBound) {
      process.off('SIGINT', this.clearAllBound);
      process.off('exit', this.clearAllBound);
    }
    if (this.server && this.handleBound) {
      this.server.off('request', this.handleBound);
      this.server.off('clientError', this.onClientErrorBound);
    }
  };
  SignalRServerHandler.prototype.clearAll = function () {
    this.closeServer();
    this.destroy();
  };
  SignalRServerHandler.prototype.startHandling = function (server) {
    this.stopHandling();
    this.server = server;
    this.server.on('request', this.handleBound);
    this.server.on('clientError', this.onClientErrorBound);
    this.wsserver = new WebSocket.Server({server: server});
    this.wsserver.on('connectionwithurl', this.onConnectionWithUrl.bind(this));
    process.on('SIGINT', this.clearAllBound);
    process.on('exit', this.clearAllBound);
  };  
  SignalRServerHandler.prototype.handle = function (req, res) {
    var up = new mylib.UrlParser(req.url, 'protocol://host/'), cors, id, ch, ra, tr;
    if (!up.isValid()) {
      res.writeHeader(404);
      res.end();
      return;
    }
    if (up.isNegotiate()) {
      cors = this.cors || req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', cors);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
      res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, X-SignalR-User-Agent");
      res.writeHeader(200);
      do {
        id = ++this.counter;
        ch = this.channels.get(id+'');
      } while (ch);
      ch = new mylib.Channel(this, id+'');
      res.end(JSON.stringify(
        {
          connectionId: id+'',
          availableTransports: [
            {
            transport: 'WebSockets',
            transferFormats: ['Text']
            },
            {
            transport: 'LongPolling',
            transferFormats: ['Text']
            }
          ]
        }
      ));
      return;
    }
    //console.log(req.method, up, 'from', req.url);
    id = up.searchParams.get('id');
    if (!id) {
      res.writeHeader(400);
      res.end();
      return;
    }
    ch = this.channels.get(id);
    if (!ch) {
      res.writeHeader(404);
      res.end();
      return;
    }
    if (!(req.socket && req.socket.remoteAddress)) {
      return;
    }
    ra = req.socket.remoteAddress;
    tr = ch.transport;
    if (!(tr instanceof mylib.LPTransport && tr.remoteAddress() == ra)) {
      tr = new mylib.LPTransport(ra);
      ch.attachTransport(tr);
      res.writeHead(200);
      res.end();
    }
    tr.handle(req, res);
  };
  SignalRServerHandler.prototype.onClientError = function (err, sock){
    sock.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  };
  SignalRServerHandler.prototype.clientInvokes = function (channel, target, args) {
    if (!this.invocationHandler) {
      return;
    }
    return this.invocationHandler(channel, target, args);
  };
  SignalRServerHandler.prototype.onConnectionWithUrl = function (connwurl) {
    if (!this.channels) { //dead already
      return;
    }
    var up, id, ch , h;
    up = new mylib.UrlParser(connwurl.url);
    id = up.searchParams.get('id');
    if (!id) {
      connwurl.connection.terminate();
      return;
    }
    ch = this.channels.get(id);
    if (!ch) {
      connwurl.connection.terminate();
      return;
    }
    h = new mylib.WSTransport(connwurl.connection);
    ch.attachTransport(h);
  };

  SignalRServerHandler.prototype.respondWithJson = function (res, obj) {
    res.write(JSON.stringify(obj));
  }

  mylib.ServerHandler = SignalRServerHandler;
}
module.exports = createSignalRServerHandler;

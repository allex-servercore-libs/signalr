function createServerLib (mylib) {
  'use strict';

  function createHttpServer(port, invocationhandler) {
    var handler = new (mylib.createLib().ServerHandler)(invocationhandler);
    var server = require('http').createServer();
    handler.startHandling(server);
    server.listen(port);
    return handler;
  }
  mylib.createHttpServer = createHttpServer;
}

module.exports = createServerLib;

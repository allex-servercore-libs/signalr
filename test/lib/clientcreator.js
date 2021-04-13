function createClientLib (mylib) {
  'use strict';

  function createHttpClient(port) {
    var connection = new (require('@microsoft/signalr').HubConnectionBuilder)()
      .withUrl('http://localhost:'+port)
      .build();

    //connection.on('blah', someHandler);
    return connection.start().then(
      qlib.returner(connection)
    );
  }

  mylib.createHttpClient = createHttpClient;
}
module.exports = createClientLib;

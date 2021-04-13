var testlib = require('./lib');

function clientInvocationHandler () {
  console.log('client wants invoke', arguments);
}
function serverInvocationHandler () {
  console.log('server sends event', arguments);
}
describe('WebSocket based tests', function () {
  it('Create Server', function () {
    return setGlobal('Server', testlib.createHttpServer(3015, clientInvocationHandler));
  });
  it('Create Client', function () {
    return setGlobal('Client', testlib.createHttpClient(3015));
  });
  it ('Send data to allexjs', function () {
    Client.send('allexjs', {bla: 5});
  });
  it ('Attach listener to client', function () {
    Client.on('_', serverInvocationHandler);
    var ch = Server.channels.get('1');
    if (ch) {
      ch.invokeOnClient('_', {aha: 7});
    } else {
      Server.channels.dumpToConsole();
    }
  });
  it('Finish trivial tests', function () {
    Server.closeServer();
    Server.destroy();
    Client.stop();
  });
  it('Generate ServerClientPair', function () {
    return setGlobal('Pair', testlib.createServerClientPair(3015));
  });
  it('Test single Server2Client', function () {
    return Pair.testSingleServerToClient('1');
  });
  it('Test sequence Server2Client', function () {
    return Pair.testSequenceServerToClient('1', 100);
  });

  it('Finish', function () {
    Pair.destroy();
  });
  /*
  */
});

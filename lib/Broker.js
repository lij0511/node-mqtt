var sys = require('sys')
  , net = require('net')
  , util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT')
  , MQTTClient = require('./MQTTClient');

/**
 * MQTTBroker
 */
var Broker = function(config) {
  
  this.config = {
    host : '0.0.0.0',
    port : 1883
  };
  
  for ( var prop in config) {
    this.config[prop] = config[prop];
  }
  /* connecting clients */
  this._clients = {};
  
  this._server = null;
  
  this.startServer();
  
};

util.inherits(Broker, events.EventEmitter);

Broker.prototype.startServer = function() {
  var self = this;
  var clientId = 1;
  this._server = net.createServer();
  this._server.on('connection', function(socket) {
    sys.log("Connection from " + socket.remoteAddress);
    var id = clientId ++;
    self._clients[id] = new MQTTClient(socket, id);
    self._clients[id].on('close', function() {
      //TODO unsubscribe
    });
  });
  
  this._server.listen(this.config.port);
};

module.exports = Broker;
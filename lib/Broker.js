var sys = require('sys')
  , net = require('net')
  , util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT')
  , MQTTClient = require('./MQTTClient')
  , Topic = require('./Topic')
  , Message = require('./Message');

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
  
  this._topic = new Topic(this);
  
  this._message = new Message();
  
};

util.inherits(Broker, events.EventEmitter);

Broker.prototype.startServer = function() {
  var self = this;
  this._server = net.createServer();
  this._server.on('connection', function(socket) {
    sys.log('connection from ' + socket.remoteAddress);
    var client = new MQTTClient(socket, self._topic, self._message);
    var timer = setTimeout(function() {
      client.disconnect();
    }, 25 * 1000);
    client.on('close', function() {
      clearTimeout(timer);
      sys.log('connection close ' + client._clientId);
      if (client._clientId) {
        if (!client._clientInfo.clientId) {
          /* connect without clientId, cleanSession */
          client.clean();
        }
        delete self._clients[client._clientId];
      }
    });
    /* sessionOpened */
    client.on('sessionOpened', function() {
      clearTimeout(timer);
      sys.log('client_' + client._clientId + ' sessionOpened');
      self._clients[client._clientId] = client;
    });
    /* sessionClosed */
    client.on('sessionClosed', function() {
      sys.log('client_' + client._clientId + ' sessionClosed');
    });
  });
  
  this._server.listen(this.config.port);
};

Broker.prototype.getClient = function(clientId) {
  return this._clients[clientId];
};

module.exports = Broker;
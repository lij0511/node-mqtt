var util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT');
  
/**
 * MQTTClient
 */
var MQTTClient = function(socket, clientId) {
  /* client socket */
  this._socket = socket;
  /* clientId */
  this._clientId = clientId;
  
  this.listenEvent();
  
};

util.inherits(MQTTClient, events.EventEmitter);

MQTTClient.prototype.listenEvent = function() {
  var self = this;
  
  /* socket events */
  /* data event */
  this._socket.on('data', function(data) {
    self.parse(data);
  });
  /* error event */
  this._socket.on('error', function(error) {
    self.emit('error', error);
  });
  /* close event */
  this._socket.on('close', function() {
    self.emit('close');
  });
  
  /* client events */
  this.on('error', function(error) {
    
  });
};

/**
 * parse data
 * @param data
 */
MQTTClient.prototype.parse = function(data) {
  
};

/**
 * disconnect the socket
 */
MQTTClient.prototype.disconnect = function() {
  this._socket.close();
};

module.exports = MQTTClient;
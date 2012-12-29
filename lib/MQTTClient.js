var sys = require('sys')
  , util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT')
  , decoder = require('./Decoder')
  , encoder = require('./Encoder');
  
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
  
  /* exec the mqtt command */
  for(var item in mqtt.MessageType) {
    self.on(mqtt.MessageType[item], function(message) {
      try{
        execCommand(self, message);
      } catch(error) {
        sys.error('client_' + this._clientId + ' error:' + error);
        /* disconnect */
        this.disconnect();
      }
    });
  }
};

/**
 * parse data
 * @param data
 */
MQTTClient.prototype.parse = function(data) {
  try{
    var message = decoder.decode(data);
    this.emit(message.type, message);
  } catch(error) {
    sys.error('client_' + this._clientId + ' error:' + error);
    /* disconnect */
    this.disconnect();
  }
};

/**
 * disconnect the socket
 */
MQTTClient.prototype.disconnect = function() {
  this._socket.end();
};

/**
 * send the buffer to socket
 */
MQTTClient.prototype.send = function(buffer) {
  this._socket.write(buffer);
};

/**
 * exec mqtt command
 * @param client
 * @param command
 * @param message
 */
function execCommand(client, message) {
  var commands = {
    /* CONNECT 0x01 */
    'CONNECT' : function() {
      var event = {type : 'CONNACK', code : message.ack};
      client.emit(event.type, event);
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      var data = encoder.encode(message);
      client.send(new Buffer(data));
    },
    /* PINGREQ 0x03 */
    'PUBLISH' : function() {
    },
    /* PINGREQ 0x04 */
    'PUBACK' : function() {
    },
    /* PINGREQ 0x05 */
    'PUBREC' : function() {
    },
    /* PINGREQ 0x06 */
    'PUBREL' : function() {
    },
    /* PINGREQ 0x07 */
    'PUBCOMP' : function() {
    },
    /* PINGREQ 0x08 */
    'SUBSCRIBE' : function() {
    },
    /* PINGREQ 0x09 */
    'SUBACK' : function() {
    },
    /* PINGREQ 0x0a */
    'UNSUBSCRIBE' : function() {
    },
    /* PINGREQ 0x0b */
    'UNSUBACK' : function() {
    },
    /* PINGREQ 0x0c */
    'PINGREQ' : function() {
    },
    /* PINGREQ 0x0d */
    'PINGRESP' : function() {
    },
    /* PINGREQ 0x0e */
    'DISCONNECT' : function() {
    }
  };
  if(message.error) {
    sys.log(message.error);
  }
  sys.log('client_' + client._clientId + ' ' + message.type);
  commands[message.type]();
};

module.exports = MQTTClient;
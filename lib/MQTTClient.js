var sys = require('sys')
  , util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT')
  , utils = require('./MQTTUtils')
  , decoder = require('./Decoder')
  , encoder = require('./Encoder');
  
/**
 * MQTTClient
 */
var MQTTClient = function(socket, topic) {
  /* client socket */
  this._socket = socket;
  this._topic = topic;
  /* clientId */
  this._clientId = null;
  
  this._clientInfo = {};
  this.sessionOpened = false;
  
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
    sys.error('client_' + this._clientId + ' error:' + error);
    if (self.sessionOpened) {
      /* publish the will message */
      
    }
  });
  
  /* exec the mqtt command */
  for (var item in mqtt.MessageType) {
    self.on(mqtt.MessageType[item], function(message) {
      try {
        execCommand(self, message);
      } catch(error) {
        this.emit('error', error);
      }
    });
  }
};

/**
 * parse data
 * @param data
 */
MQTTClient.prototype.parse = function(data) {
  try {
    var message = decoder.decode(data);
    this.emit(message.type, message);
  } catch(error) {
    this.emit('error', error);
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
 * publish message
 */
MQTTClient.prototype.publish = function(qos, message) {
  /* qos/message.qos */
  this._socket.write(message.data);
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
      if (!client.sessionOpened) {
        /* ok */
        if (message.ack === 0) {
          client._clientInfo = message;
          client.sessionOpened = true;
          if (message.clientId) {
            client._clientId = message.clientId;
            if (message.cleanSession) {
              /* cleanup topic subscriptions */
            } else {
              /* force the republish of stored QoS1 and QoS2 */
            }
          } else {
            client._clientId = utils.genClientId();
          }
          client.emit('sessionOpened', client._clientId);
        }
      }
      /* connect acknowledgment */
      var event = {type : 'CONNACK', ack : message.ack};
      client.emit(event.type, event);
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      var data = encoder.encode(message);
      client.send(new Buffer(data));
    },
    /* PINGREQ 0x03 */
    'PUBLISH' : function() {
      if (client.sessionOpened) {
        client._topic.publish(message.topic, message);
      }
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
      if (client.sessionOpened) {
        for (var i = 0; i < message.topics.length; i++) {
          client._topic.subscribe(client._clientId, message.topics[i].topic, message.topics[i].qos);
        }
        /* subscreibe acknowledgment */
        var event = {type : 'SUBACK', messageId : message.messageId, topics : message.topics};
        client.emit(event.type, event);
      }
    },
    /* PINGREQ 0x09 */
    'SUBACK' : function() {
      if (client.sessionOpened) {
        var data = encoder.encode(message);
        client.send(new Buffer(data));
      }
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
      if (client.sessionOpened) {
        client._clientInfo = {};
        client.sessionOpened = false;
        client.emit('sessionClosed', client._clientId);
      }
    }
  };
  if (message.error) {
    sys.log(message.error);
  }
  sys.log('client_' + client._clientId + ' ' + message.type);
  commands[message.type]();
};

module.exports = MQTTClient;
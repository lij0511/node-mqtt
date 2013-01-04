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
var MQTTClient = function(socket, topic, message) {
  /* client socket */
  this._socket = socket;
  this._topic = topic;
  this._message = message;
  
  /* clientId */
  this._clientId = null;
  
  this._nextMessageId = 1;
  
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
    var trunkLength = message.offset + message.remainingLength;
    while (trunkLength < data.length) {
      data = data.slice(trunkLength);
      var message = decoder.decode(data);
      this.emit(message.type, message);
      trunkLength = message.offset + message.remainingLength;
    }
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
 * @param buffer
 */
MQTTClient.prototype.send = function(buffer) {
  this._socket.write(buffer);
};

/**
 * publish message
 */
MQTTClient.prototype.publish = function(qos, message) {
  message.messageId = utils.genMessageId(this._nextMessageId ++);
  /* qos/message.qos */
  if(qos < message.qos) {
    message.qos = qos;
  }
  if(message.qos == 0) {
  }
  if(message.qos == 1) {
    this._message.qos1(this._clientId, message);
  }
  if(message.qos == 2) {
    /* store message to qos2 */
    this._message.qos2(this._clientId, message);
  }
  var data = encoder.encode(message);
  this.send(data);
};

/**
 * exec mqtt command
 * @param client
 * @param command
 * @param message
 */
function execCommand(client, message) {
  var sendMessage = function(m) {
    var data = encoder.encode(m);
    client.send(data);
  };
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
      var m = {type : 'CONNACK', ack : message.ack};
      sendMessage(m);
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      if (client.sessionOpened) {
        if(message.qos == 0) {
          client._topic.publish(message.topic, message);
        }
        if(message.qos == 1) {
          var m = {type : 'PUBACK', messageId : message.messageId};
          sendMessage(m);
          client._topic.publish(message.topic, message);
        }
        if(message.qos == 2) {
          /* store message to qos2 */
          client._message.qos2(client._clientId, message);
          var m = {type : 'PUBREC', messageId : message.messageId};
          sendMessage(m);
        }
      }
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      /* publish acknowledgment */
      if (client.sessionOpened) {
        client._message.getQos1(client._clientId, message.messageId);
      }
    },
    /* PUBREC 0x05 */
    'PUBREC' : function() {
      /* publish received */
      if (client.sessionOpened) {
        var m = {type : 'PUBREL', messageId : message.messageId};
        sendMessage(m);
      }
    },
    /* PUBREL 0x06 */
    'PUBREL' : function() {
      if (client.sessionOpened) {
        var m = {type : 'PUBCOMP', messageId : message.messageId};
        sendMessage(m);
        /* publish release */
        /* send to SUBSCRIBERS */
        var mes = client._message.getQos2(client._clientId, message.messageId);
        if(mes) {
          client._topic.publish(mes.topic, mes);
          client._message.removeQos2(client._clientId, message.messageId);
        }
      }
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
      if (client.sessionOpened) {
        /* publish complete */
        client._message.removeQos2(client._clientId, message.messageId);
      }
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
      if (client.sessionOpened) {
        for (var i = 0; i < message.topics.length; i++) {
          client._topic.subscribe(client._clientId, message.topics[i].topic, message.topics[i].qos);
        }
        /* unsubscribe acknowledgment */
        var m = {type : 'SUBACK', messageId : message.messageId, topics : message.topics};
        sendMessage(m);
      }
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
    },
    /* UNSUBSCRIBE 0x0a */
    'UNSUBSCRIBE' : function() {
      if (client.sessionOpened) {
        for (var i = 0; i < message.topics.length; i++) {
          client._topic.unsubscribe(client._clientId, message.topics[i]);
        }
        /* unsubscribe acknowledgment */
        var m = {type : 'UNSUBACK', messageId : message.messageId, topics : message.topics};
        sendMessage(m);
      }
    },
    /* UNSUBACK 0x0b */
    'UNSUBACK' : function() {
    },
    /* PINGREQ 0x0c */
    'PINGREQ' : function() {
      if (client.sessionOpened) {
        var m = {type : 'PINGRESP'};
        sendMessage(m);
      }
    },
    /* PINGRESP 0x0d */
    'PINGRESP' : function() {
    },
    /* DISCONNECT 0x0e */
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
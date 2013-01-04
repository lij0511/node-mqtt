var sys = require('sys')
  , net = require('net')
  , util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT')
  , utils = require('./MQTTUtils')
  , decoder = require('./Decoder')
  , encoder = require('./Encoder');

/**
 * MQTT Client
 */
var Client = function(config) {
  this.config = {
    host : '127.0.0.1',
    port : 1883,
    clientId : '',
    username : '',
    password : '',
    keepAlive : 30000
  };
  
  for ( var prop in config) {
    this.config[prop] = config[prop];
  }
  
  this._clientId = this.config.clientId;
  
  this._nextMessageId = 1;
  
  this._socket = null;
  
  this.sessionOpened = false;
  
  this._timers = {};
  
  this.connectServer();
  
  this.listenEvent();
  
};

util.inherits(Client, events.EventEmitter);

/**
 * connect to mqtt server
 */
Client.prototype.connectServer = function() {
  var self = this;
  this._socket = net.connect(this.config.port, this.config.host, function() {
    self.connect();
  });
};

Client.prototype.listenEvent = function() {
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
  
  /* client events */
  this.on('error', function(error) {
    sys.error('client error:' + error);
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
Client.prototype.parse = function(data) {
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
 * send the buffer to socket
 * @param buffer
 */
Client.prototype.send = function(buffer) {
  this._socket.write(buffer);
};

/**
 * send the buffer to socket
 * @param buffer
 */
Client.prototype.sendQos1 = function(message) {
  var data = encoder.encode(message);
  var self = this;
  var t = 3;
  var timeout = 3000;
  var timer = function() {
    if (--t <= 0) {
      sys.error(message.type + '_' + message.messageId + ' failed, timeout');
      return;
    }
    self._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
    self.send(data);
  };
  /* wait for ACK */
  this._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
  this.send(data);
};

/**
 * send connect message
 */
Client.prototype.connect = function() {
  var m = {type : 'CONNECT'
    , clientId : this.config.clientId
    , keepAlive : this.config.keepAlive};
  var data = encoder.encode(m);
  this.send(data);
};

/**
 * subscribe
 * @param topics
 */
Client.prototype.subscribe = function(topic) {
  var topics = {};
  /* set qos = 1 */
  topics[topic] = 1;
  var m = {type : 'SUBSCRIBE'
    , messageId : utils.genMessageId(this._nextMessageId ++)
    , topics : topics};
  this.sendQos1(m);
};

/**
 * unsubscribe
 * @param topics
 */
Client.prototype.unsubscribe = function(topic) {
  var topics = [];
  topics[0] = topic;
  var m = {type : 'UNSUBSCRIBE'
    , messageId : utils.genMessageId(this._nextMessageId ++)
    , topics : topics};
  this.sendQos1(m);
};

/**
 * publish
 * @param topic
 * @param payload
 */
Client.prototype.publish = function(topic, payload) {
  var m = {type : 'PUBLISH'
    , qos : 1
    , dup : 0
    , retain : 0
    , messageId : utils.genMessageId(this._nextMessageId ++)
    , topic : topic
    , payload : payload};
  var data = encoder.encode(m);
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
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      if(message.ack == 0) {
        client.sessionOpened = true;
        client.emit('sessionOpened');
      } else {
        sys.log('Connection refused by server');
      }
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      /* publish */
      if (client.sessionOpened) {
        if (message.qos == 0) {
          client.emit('message', message.topic, message.payload);
        }
        if (message.qos == 1) {
          client.emit('message', message.topic, message.payload);
        }
        if (message.qos == 2) {
          
        }
      }
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      /* publish acknowledgment */
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
      /* send to Application */
      if (client.sessionOpened) {
        var m = {type : 'PUBCOMP', messageId : message.messageId};
        sendMessage(m);
      }
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
      /* publish complete */
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
      if (client.sessionOpened) {
        if (client._timers['SUBSCRIBE_' + message.messageId]) {
          clearTimeout(client._timers['SUBSCRIBE_' + message.messageId]);
          delete client._timers['SUBSCRIBE_' + message.messageId];
        }
      }
    },
    /* UNSUBSCRIBE 0x0a */
    'UNSUBSCRIBE' : function() {
    },
    /* UNSUBACK 0x0b */
    'UNSUBACK' : function() {
      if (client._timers['UNSUBSCRIBE_' + message.messageId]) {
        clearTimeout(client._timers['UNSUBSCRIBE_' + message.messageId]);
        delete client._timers['UNSUBSCRIBE_' + message.messageId];
      }
    },
    /* PINGREQ 0x0c */
    'PINGREQ' : function() {
    },
    /* PINGRESP 0x0d */
    'PINGRESP' : function() {
    },
    /* DISCONNECT 0x0e */
    'DISCONNECT' : function() {
    }
  };
  if (message.error) {
    sys.log(message.error);
  }
  sys.log('client_' + client._clientId + ' ' + message.type);
  commands[message.type]();
};

module.exports = Client;
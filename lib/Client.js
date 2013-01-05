var sys = require('sys')
  , net = require('net')
  , util = require('util')
  , events = require('events')
  , mqtt = require('./MQTT')
  , utils = require('./MQTTUtils')
  , decoder = require('./Decoder')
  , encoder = require('./Encoder')
  , Message = require('./Message');

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
    keepAlive : 30 * 1000
  };
  
  for ( var prop in config) {
    this.config[prop] = config[prop];
  }
  
  this._clientId = this.config.clientId;
  
  this._nextMessageId = 1;
  
  this._socket = null;
  
  this.sessionOpened = false;
  this.connecting = false;
  
  this._message = new Message();
  
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
    self.heartbeat();
    self.connect();
  });
};

Client.prototype.listenEvent = function() {
  var self = this;
  /* socket events */
  /* data event */
  this._socket.on('data', function(data) {
    if(self.sessionOpened) {
      self.connecting = true;
      self.heartbeat();
    }
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
    sys.error('client error:' + error);
  });
  
  /* exec the mqtt command */
  for (var item in mqtt.MessageType) {
    self.on(mqtt.MessageType[item], function(message) {
      try {
        if (message.error) {
          sys.log(message.error);
        }
        sys.log('client_' + self._clientId + ' ' + message.type);
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
 * send message
 * @param message
 */
Client.prototype.sendMessage = function(message) {
  var data = encoder.encode(message);
  this._socket.write(data);
};

/**
 * send the buffer to socket
 * @param message
 */
Client.prototype.sendQos1 = function(message) {
  var data = encoder.encode(message);
  var self = this;
  var t = 3;
  var timeout = 3000;
  var timer = function() {
    if (--t <= 0) {
      sys.error(message.type + '_' + message.messageId + ' failed, timeout');
      delete self._timers[message.type + '_' + message.messageId];
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
 * send the buffer to socket
 * @param message
 */
Client.prototype.sendQos2 = function(message) {
  var data = encoder.encode(message);
  var self = this;
  var t = 3;
  var timeout = 3000;
  var timer = function() {
    if (--t <= 0) {
      sys.error(message.type + '_' + message.messageId + ' failed, timeout');
      delete self._timers[message.type + '_' + message.messageId];
      return;
    }
    self._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
    self.send(data);
  };
  /* wait for REC */
  this._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
  this.send(data);
};

Client.prototype.clearTimeout = function(timer) {
  if (this._timers[timer]) {
    clearTimeout(this._timers[timer]);
    delete this._timers[timer];
  }
};

/**
 * close socket
 */
Client.prototype.close = function() {
  this._socket.end();
};

/**
 * send connect message
 */
Client.prototype.connect = function() {
  var m = {type : 'CONNECT'
    , clientId : this.config.clientId
    , keepAlive : this.config.keepAlive};
  this.sendMessage(m);
};

/**
 * send disconnect message
 */
Client.prototype.disconnect = function() {
  var m = {type : 'DISCONNECT'};
  this.sendMessage(m);
};

Client.prototype.heartbeat = function() {
  var self = this;
  if (this._timers['heartbeat']) {
    clearTimeout(this._timers['heartbeat']);
  }
  this._timers['heartbeat'] = setTimeout(function() {
    if (self.sessionOpened && self.connecting) {
      self.connecting = false;
      var m = {type : 'PINGREQ'};
      self.sendMessage(m);
      self.heartbeat();
    } else if (self.sessionOpened && !self.connecting) {
      sys.log('MQTT connect to server time out');
      self.close();
    } else {
      sys.log('openSessionFailed');
      self.close();
    }
  }, 15 * 1000);
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
 * @param qos
 * @param retain
 */
Client.prototype.publish = function(topic, payload, qos, retain) {
  var m = {type : 'PUBLISH'
    , qos : (qos ? qos : 0)
    , dup : 0
    , retain : (retain ? retain : 0)
    , messageId : utils.genMessageId(this._nextMessageId ++)
    , topic : topic
    , payload : payload};
  if (m.qos == 1) {
    this.sendQos1(m);
  } else if (m.qos == 2) {
    this.sendQos2(m);
  } else {
    m.qos = 0;
    this.sendMessage(m);
  }
};

/**
 * send the message to Application 
 * @param message
 */
Client.prototype.onMessage = function(message) {
  this.emit('message', message.topic, message.payload);
};

/**
 * sessionClosed
 */
Client.prototype.onSessionClosed = function() {
  this.sessionOpened = false;
  this.emit('sessionClosed');
};

var execCommand = mqtt.mqttCommand;

/**
 * exec mqtt command
 * @param client
 * @param command
 * @param message
 */
function exec1Command(client, message) {
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
      if (!client.sessionOpened) {
        if (message.ack == 0) {
          client.sessionOpened = true;
          client.connecting = true;
          client.emit('sessionOpened');
          client.heartbeat();
        } else {
          sys.log('Connection refused by server');
          client.emit('openSessionFailed');
        }
      }
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      /* publish */
      if (client.sessionOpened) {
        if (message.qos == 0) {
          client.onMessage(message);
        }
        if (message.qos == 1) {
          /* send PUBACK */
          var m = {type : 'PUBACK', messageId : message.messageId};
          sendMessage(m);
          client.onMessage(message);
        }
        if (message.qos == 2) {
          /* store message to qos2 */
          client._message.qos2(client._clientId, message);
          var m = {type : 'PUBREC', messageId : message.messageId};
          client.sendQos2(m);
        }
      }
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      /* publish acknowledgment */
      if (client.sessionOpened) {
        client._message.removeQos1(client._clientId, message.messageId);
        client.clearTimeout('PUBLISH_' + message.messageId);
      }
    },
    /* PUBREC 0x05 */
    'PUBREC' : function() {
      /* publish received */
      if (client.sessionOpened) {
        client._message.qos2(client._clientId, message);
        client.clearTimeout('PUBLISH_' + message.messageId);
        var m = {type : 'PUBREL', messageId : message.messageId};
        client.sendQos2(m);
      }
    },
    /* PUBREL 0x06 */
    'PUBREL' : function() {
      if (client.sessionOpened) {
        var m = {type : 'PUBCOMP', messageId : message.messageId};
        sendMessage(m);
        /* send to Application */
        var mes = client._message.getQos2(client._clientId, message.messageId);
        if (mes) {
          client.onMessage(message);
          client._message.removeQos2(client._clientId, message.messageId);
        }
        client.clearTimeout('PUBREC_' + message.messageId);
      }
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
      /* publish complete */
      if (client.sessionOpened) {
        client._message.removeQos2(client._clientId, message.messageId);
        client.clearTimeout('PUBREL_' + message.messageId);
      }
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
      if (client.sessionOpened) {
        client.clearTimeout('SUBSCRIBE_' + message.messageId);
      }
    },
    /* UNSUBSCRIBE 0x0a */
    'UNSUBSCRIBE' : function() {
    },
    /* UNSUBACK 0x0b */
    'UNSUBACK' : function() {
      if (client.sessionOpened) {
        client.clearTimeout('UNSUBSCRIBE_' + message.messageId);
      }
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
        client.sessionOpened = false;
        client.emit('sessionClosed');
      }
    }
  };
  if (message.error) {
    sys.log(message.error);
  }
  sys.log('client_' + client._clientId + ' ' + message.type);
  commands[message.type]();
};

module.exports = Client;
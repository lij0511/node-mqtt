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
  this._clientId = utils.genClientId();
  
  this._nextMessageId = 1;
  
  this._clientInfo = {};
  this.sessionOpened = false;
  
  this._timers = {};
  
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
      /* disconnect */
      self.disconnect();
    }
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
 * @param message
 */
MQTTClient.prototype.sendQos1 = function(message) {
  var self = this;
  var t = 3;
  var timeout = 3000;
  var timer = function() {
    if (--t <= 0) {
      sys.error('client_' + self._clientId + ' ' + message.type + '_' + message.messageId + ' failed, timeout');
      delete self._timers[message.type + '_' + message.messageId];
      return;
    }
    self._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
    message.dup = 1;
    self.sendMessage(message);
  };
  /* wait for ACK */
  this._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
  this.sendMessage(message);
};

/**
 * send the buffer to socket
 * @param message
 */
MQTTClient.prototype.sendQos2 = function(message) {
  var self = this;
  var t = 3;
  var timeout = 3000;
  var timer = function() {
    if (--t <= 0) {
      sys.error('client_' + self._clientId + ' ' + message.type + '_' + message.messageId + ' failed, timeout');
      delete self._timers[message.type + '_' + message.messageId];
      return;
    }
    self._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
    message.dup = 1;
    self.sendMessage(message);
  };
  /* wait for REC */
  this._timers[message.type + '_' + message.messageId] = setTimeout(timer, timeout);
  this.sendMessage(message);
};

MQTTClient.prototype.clearTimeout = function(timer) {
  if (this._timers[timer]) {
    clearTimeout(this._timers[timer]);
    delete this._timers[timer];
  }
};

/**
 * send message
 * @param message
 */
MQTTClient.prototype.sendMessage = function(message) {
  var data = encoder.encode(message);
  this._socket.write(data);
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
 * @param qos
 * @param message
 */
MQTTClient.prototype.publish = function(qos, message) {
  message.messageId = utils.genMessageId(this._nextMessageId ++);
  /* qos/message.qos */
  if(qos < message.qos) {
    message.qos = qos;
  }
  if(message.qos == 0) {
    this.sendMessage(message);
  }
  if(message.qos == 1) {
    this._message.qos1(this._clientId, message);
    this.sendQos1(message);
  }
  if(message.qos == 2) {
    /* store message to qos2 */
    this._message.qos2(this._clientId, message);
    this.sendQos2(message);
  }
};

/**
 * clean session
 */
MQTTClient.prototype.clean = function() {
  if (this._clientId) {
    /* cleanup topic subscriptions */
    this._topic.clean(this._clientId);
    this._message.clean(this._clientId);
  }
};

/**
 * republish of stored QoS1 and QoS2
 */
MQTTClient.prototype.republish = function() {
  if (this._clientId) {
    var qos2messages = this._message.republishQos2(this._clientId);
    if (qos2messages) {
      for (var messageId in qos2messages) {
        this.sendMessage(qos2messages[messageId]);
      }
    }
    var qos1messages = this._message.republishQos1(this._clientId);
    if (qos1messages) {
      for (var messageId in qos1messages) {
        this.sendMessage(qos2messages[messageId]);
      }
    }
  }
};

/**
 * publish the message to subscribers 
 * @param message
 */
MQTTClient.prototype.onMessage = function(message) {
  this._topic.publish(message.topic, message);
  if (message.retain == true) {
    this._topic.retain(message.topic, message);
  }
};

/**
 * sessionClosed
 */
MQTTClient.prototype.onSessionClosed = function() {
  this._clientInfo = {};
  this.sessionOpened = false;
  this.emit('sessionClosed');
};

/**
 * exec mqtt command
 * @param client
 * @param message
 */
var execCommand = mqtt.mqttCommand;

module.exports = MQTTClient;
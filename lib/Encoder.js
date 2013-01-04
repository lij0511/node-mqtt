var mqtt = require('./MQTT')
  , utils = require('./MQTTUtils');

Buffer.prototype.toByteArray = function () { 
  return Array.prototype.slice.call(this, 0);
};

var encodeLength = function(value) {
  if (!value) {
    throw('Protocol error - error data');
  }
  var length = [];
  length[0] = (value & 0xFF00) >> 8;//msb
  length[1] = value & 0x00FF;//lsb
  return length;
};

var encodeString = function(str) {
  if (!str) {
    throw('Protocol error - error data');
  }
  var strBuffer = new Buffer(str, 'utf8');
  var strArray = strBuffer.toByteArray();
  delete strBuffer;
  var length = encodeLength(strArray.length);
  return length.concat(strArray);
};

var encodeRemainingLength = function(length) {
  if (length > 268435455 || length < 0) {
    throw('Protocol error - remaining length too large');
  }
  var encoded = [];
  do {
    var digit = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) {
      digit = (digit | 0x80);
    }
    encoded.push(digit);
  } while(length > 0);
  return encoded;
};

/**
 * mqtt encoder
 */
var messageEncode = function(message) {
  var type = message.type;
  var encoders = {
    /* CONNECT 0x01 */
    'CONNECT' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.CONNECT, 0, 0, 0);
      var variableHeader = mqtt.VERSION;
      var connectFlag = 0;
      if (message.hasUsername == true) {
        connectFlag |= 0x80;
      }
      if (message.hasPassword == true) {
        connectFlag |= 0x40;
      }
      if (message.willRetain == true) {
        connectFlag |= 0x20;
      }
      if (message.willQos == true) {
        connectFlag |= (message.willQos & 0x03) << 3;
      }
      if (message.willFlag == true) {
        connectFlag |= 0x04;
      }
      if (message.cleanSession == true) {
        connectFlag |= 0x02;
      }
      variableHeader.push(connectFlag);
      var keepAlive = encodeLength(message.keepAlive);
      variableHeader = variableHeader.concat(keepAlive);
      if (message.clientId) {
         variableHeader = variableHeader.concat(encodeString(message.clientId));
      }
      if (message.willFlag == true) {
        variableHeader = variableHeader.concat(encodeString(message.willTopic)).concat(encodeString(message.willMessage));
      }
      if (message.hasUsername == true) {
        variableHeader = variableHeader.concat(encodeString(message.username));
      }
      if (message.hasPassword == true) {
        variableHeader = variableHeader.concat(encodeString(message.password));
      }
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.CONNACK, 0, 0, 0);
      var variableHeader = [0x00, message.ack];
      var length = encodeRemainingLength(2);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBLISH, message.dup, message.qos, message.retain);
      var variableHeader = encodeString(message.topic);
      if (message.qos == 1 || message.qos == 2) {
        var messageId = encodeLength(message.messageId);
        variableHeader = variableHeader.concat(messageId);
      }
       
      var length = encodeRemainingLength(variableHeader.length + message.payload.length);
      return utils.concat(new Buffer(fixedHeader.concat(length).concat(variableHeader)), message.payload);
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBACK, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* PUBREC 0x05 */
    'PUBREC' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBREC, 0, 1, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* PUBREL 0x06 */
    'PUBREL' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBREL, 0, 1, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBCOMP, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.SUBSCRIBE, 0, 1, 0);
      var variableHeader = encodeLength(message.messageId);
      for(var item in message.topics) {
        var topic = encodeString(item);
        topic.push(message.topics[item]);
        variableHeader = variableHeader.concat(topic);
      }
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.SUBACK, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      var topics = [];
      for (var i = 0; i < message.topics.length; i++) {
        topics[i] = message.topics[i].qos & 0x03;
      }
      variableHeader = variableHeader.concat(topics);
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* UNSUBSCRIBE 0x0a */
    'UNSUBSCRIBE' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.UNSUBSCRIBE, 0, 1, 0);
      var variableHeader = encodeLength(message.messageId);
      for(var i = 0; i < message.topics.length; i++) {
        var topic = encodeString(message.topics[i]);
        variableHeader = variableHeader.concat(topic);
      }
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* UNSUBACK 0x0b */
    'UNSUBACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.UNSUBACK, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return new Buffer(fixedHeader.concat(length).concat(variableHeader));
    },
    /* PINGREQ 0x0c */
    'PINGREQ' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PINGREQ, 0, 0, 0);
      fixedHeader.push(0);
      return new Buffer(fixedHeader);
    },
    /* PINGRESP 0x0d */
    'PINGRESP' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PINGRESP, 0, 0, 0);
      fixedHeader.push(0);
      return new Buffer(fixedHeader);
    },
    /* DISCONNECT 0x0e */
    'DISCONNECT' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.DISCONNECT, 0, 0, 0);
      fixedHeader.push(0);
      return new Buffer(fixedHeader);
    }
  };
  var encoder = encoders[type];
  if (!encoder) {
    throw("Protocol error - message type error");
  }
  return encoder();
};

module.exports.encode = function(message) {
  return messageEncode(message);
};
var mqtt = require('./MQTT');

var encodeLength = function(value) {
  var lengthBuffer = new Buffer(2);
  lengthBuffer[0] = (value & 0xFF00) >> 8;//msb
  lengthBuffer[1] = value & 0x00FF;//lsb
  return lengthBuffer;
};

var encodeString = function(str) {
  var strBuffer = new Buffer(str, 'utf8');
  var length = encodeLength(strBuffer.length);
  return length + strBuffer;
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
  return new Buffer(encoded);
};

/**
 * mqtt encoder
 */
var messageEncode = function(message) {
  var type = message.type;
  var encoders = {
    /* CONNECT 0x01 */
    'CONNECT' : function() {
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.CONNACK, 0, 0, 0));
      var variableHeader = new Buffer([0x00, message.ack]);
      var length = encodeRemainingLength(2);
      return fixedHeader + length + variableHeader;
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.PUBLISH, message.dup, message.qos, message.retain));
      var variableHeader = encodeString(message.topic);
      if (message.qos == 1 || message.qos == 2) {
        var messageId = encodeLength(message.messgeId);
        variableHeader = variableHeader + messageId;
      }
       
      var length = encodeRemainingLength(variableHeader.length + message.data.length);
      return fixedHeader + length + variableHeader + message.data;
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.PUBACK, 0, 0, 0));
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader + length + variableHeader;
    },
    /* PUBREC 0x05 */
    'PUBREC' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.PUBREC, 0, 1, 0));
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader + length + variableHeader;
    },
    /* PUBREL 0x06 */
    'PUBREL' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.PUBREL, 0, 1, 0));
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader + length + variableHeader;
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.PUBCOMP, 0, 0, 0));
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader + length + variableHeader;
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
      var fixedHeader = new Buffer(mqtt.FixedHeader(mqtt.MessageCode.SUBACK, 0, 0, 0));
      var variableHeader = encodeLength(message.messageId);
      var topics = new Buffer(message.topics.length);
      for (var i = 0; i < message.topics.length; i++) {
        topics[i] = message.topics[i].qos & 0x03;
      }
      variableHeader = variableHeader + topics;
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader + length + variableHeader;
    },
    /* UNSUBSCRIBE 0x0a */
    'UNSUBSCRIBE' : function() {
    },
    /* UNSUBACK 0x0b */
    'UNSUBACK' : function() {
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
  var encoder = encoders[type];
  if (!encoder) {
    throw("Protocol error - message type error");
  }
  return encoder();
};

module.exports.encode = function(message) {
  return messageEncode(message);
};
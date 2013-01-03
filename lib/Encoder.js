var mqtt = require('./MQTT');

var encodeLength = function(value) {
  var msb = (value & 0xFF00) >> 8; //remove sign extension due to casting
  var lsb = value & 0x00FF;
  return [msb, lsb];
};

var encodeString = function(str) {
  var strArray = str.split('');
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
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.CONNACK, 0, 0, 0);
      var variableHeader = [0x00, message.ack];
      var length = encodeRemainingLength(2);
      return fixedHeader.concat(length).concat(variableHeader);
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBLISH, message.dup, message.qos, message.retain);
      var variableHeader = encodeString(message.topic);
      if (message.qos == 1 || message.qos == 2) {
        var messageId = encodeLength(message.messgeId);
        variableHeader.concat(messageId);
      }
      var length = encodeRemainingLength(variableHeader.length + message.data.length);
      return fixedHeader.concat(length).concat(variableHeader).concat(message.data);
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBACK, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader.concat(length).concat(variableHeader);
    },
    /* PUBREC 0x05 */
    'PUBREC' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.PUBREC, 0, 1, 0);
      var variableHeader = encodeLength(message.messageId);
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader.concat(length).concat(variableHeader);
    },
    /* PUBREL 0x06 */
    'PUBREL' : function() {
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.SUBACK, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      for (var i = 0; i < message.topics.length; i++) {
        variableHeader.push(message.topics[i].qos & 0x03);
      }
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader.concat(length).concat(variableHeader);
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
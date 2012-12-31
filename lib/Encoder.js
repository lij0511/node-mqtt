var mqtt = require('./MQTT');

var encodeLength = function(value) {
  var msb = (value & 0xFF00) >> 8; //remove sign extension due to casting
  var lsb = value & 0x00FF;
  return [msb, lsb];
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
      var fixedHeader = mqtt.FixedHeader(mqtt.MessageCode.SUBACK, 0, 0, 0);
      var variableHeader = encodeLength(message.messageId);
      for(var i = 0; i < message.topics.length; i++) {
        variableHeader.push(message.topics[i].qos & 0x03);
      }
      var length = encodeRemainingLength(variableHeader.length);
      return fixedHeader.concat(length).concat(variableHeader);
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
  var encoder = encoders[type];
  if(!encoder) {
    throw("Protocol error - message type error");
  }
  return encoder();
};

module.exports.encode = function(message) {
  return messageEncode(message);
};
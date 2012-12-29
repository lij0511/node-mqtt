var mqtt = require('./MQTT');

/**
 * mqtt decoder
 */
var Decoder = function(data) {
  this.data = data;
};

/* decode remaining length */
Decoder.prototype.decodeRemainingLength = function() {
  var length = 0;
  var mul = 1;
  for(var i = 1; i < this.data.length; i++) {
    if(i > 4) {
      /* limits the number of bytes to a maximum of four */
      throw("remaining_length field too long");
    }
    length += (this.data[i] & 0x7F) * mul;
    mul *= 0x80;
    if(!(this.data[i] & 0x80)) {
      /* remove the fixed header from data */
      this.data = this.data.slice(1 + i);
      return length;
    }
  }
  throw("no data");
};

/* decode the fixedHeader */
Decoder.prototype.decodeFixedHeader = function() {
  var fixedHeader = {
    messageType : (this.data[0] & 0xF0) >> 4,
    dup : ((this.data[0] & 0x08) === 0x08),
    qos : (this.data[0] & 0x06) >> 1,
    retain : ((this.data[0] & 0x01) !== 0)
  };
  var length = this.decodeRemainingLength();
  fixedHeader.remainingLength = length;
  return fixedHeader;
};

Decoder.prototype.decode = function() {
  this.fixedHeader = this.decodeFixedHeader();
  var message = messageDecode(this.fixedHeader, this.data);
  return message;
};

var messageDecode = function(fixedHeader, data) {
  var messageType = mqtt.MessageType[fixedHeader.messageType];
  if(!messageType) {
    throw("message type error");
  }
  var message = {fixedHeader : fixedHeader, type : messageType};
  var decoders = {
    /* CONNECT 0x01 */
    'CONNECT' : function() {
      var version = new Buffer(mqtt.VERSION);
      if(data.slice(0, version.length).toString('utf8') !== version.toString('utf8')) {
        message.error = 'invalid version';
        message.ack = 1;
        return message;
      }
      message.ack = 0;
      return message;
    },
    /* PINGREQ 0x02 */
    'CONNACK' : function() {
      return message;
    },
    /* PINGREQ 0x03 */
    'PUBLISH' : function() {
      return message;
    },
    /* PINGREQ 0x04 */
    'PUBACK' : function() {
      return message;
    },
    /* PINGREQ 0x05 */
    'PUBREC' : function() {
      return message;
    },
    /* PINGREQ 0x06 */
    'PUBREL' : function() {
      return message;
    },
    /* PINGREQ 0x07 */
    'PUBCOMP' : function() {
      return message;
    },
    /* PINGREQ 0x08 */
    'SUBSCRIBE' : function() {
      return message;
    },
    /* PINGREQ 0x09 */
    'SUBACK' : function() {
      return message;
    },
    /* PINGREQ 0x10 */
    'UNSUBSCRIBE' : function() {
      return message;
    },
    /* PINGREQ 0x11 */
    'UNSUBACK' : function() {
      return message;
    },
    /* PINGREQ 0x12 */
    'PINGREQ' : function() {
      return message;
    },
    /* PINGREQ 0x13 */
    'PINGRESP' : function() {
      return message;
    },
    /* PINGREQ 0x14 */
    'DISCONNECT' : function() {
      return message;
    }
  };
  /* call the decode function */
  return decoders[messageType]();
};

module.exports.decode = function(data) {
  var decoder = new Decoder(data);
  return decoder.decode();
};
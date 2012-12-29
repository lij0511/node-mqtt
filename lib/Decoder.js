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
      throw("Protocol error - remaining_length field too long");
    }
    length += (this.data[i] & 0x7F) * mul;
    mul *= 0x80;
    if(!(this.data[i] & 0x80)) {
      /* remove the fixed header from data */
      this.data = this.data.slice(1 + i);
      return length;
    }
  }
  throw("Protocol error - no data");
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
  if(this.fixedHeader.remainingLength !== this.data.length) {
    throw("Protocol error - error data");
  }
  var message = messageDecode(this.fixedHeader, this.data);
  return message;
};

var messageDecode = function(fixedHeader, data) {
  var messageType = mqtt.MessageType[fixedHeader.messageType];
  if(!messageType) {
    throw("Protocol error - message type error");
  }
  var _count = 0;
  var _getLength = function() {
    /* get MSB and multiply by 256 */
    var l = data[_count++] << 8;
    /* get LSB and sum to MSB */
    return l += data[_count++];
  };
  var message = {fixedHeader : fixedHeader, type : messageType};
  var decoders = {
    /* CONNECT 0x01 */
    'CONNECT' : function() {
      /* decode variable header begin */
      /* decode VERSION */
      var version = new Buffer(mqtt.VERSION);
      if(data.slice(0, version.length).toString('utf8') !== version.toString('utf8')) {
        message.error = 'invalid version';
        message.ack = 1;
        return message;
      }
      _count += version.length;
      /* username/password bit 7-6 */
      message.hasUsername = ((data[_count] >> 7) === 1);
      message.hasPassword = ((data[_count] >> 6) === 3);
      /* willRetain bit 5 */
      message.willRetain = ((data[_count] & 0x20) !== 0);
      /* willQos bit 4-3 */
      message.willQos = ((data[_count] & 0x18) >> 3);
      /* willFlag bit 2 */
      message.willFlag = ((data[_count] & 0x04) !== 0);
      /* cleanSession bit 1 */
      message.cleanSession = ((data[_count] & 0x02) !== 0);
      
      _count++;
      
      /* keepAlive byte1 */
      message.keepAlive = (data[_count++] << 8);
      /* keepAlive byte2 */
      message.keepAlive += data[_count++];
      /* decode variable header end */
      
      /* decode payload begin */
      /* client id length */
      message.clientIdLength = _getLength();
      if(message.clientIdLength > 23) {
        message.error = 'identifier rejected';
        message.ack = 2;
        return message;
      }
      if(message.clientIdLength + _count > data.length) {
        throw('Protocol error - client ID length');
      }
      
      message.ack = 0;
      /* decode payload end */
      
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
    /* PINGREQ 0x0a */
    'UNSUBSCRIBE' : function() {
      return message;
    },
    /* PINGREQ 0x0b */
    'UNSUBACK' : function() {
      return message;
    },
    /* PINGREQ 0x0c */
    'PINGREQ' : function() {
      return message;
    },
    /* PINGREQ 0x0d */
    'PINGRESP' : function() {
      return message;
    },
    /* PINGREQ 0x0e */
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
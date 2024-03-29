var mqtt = require('./MQTT');

/**
 * mqtt decoder
 */
var Decoder = function() {
};

/* decode remaining length */
Decoder.prototype.decodeRemainingLength = function(data) {
  var length = 0;
  var mul = 1;
  for (var i = 1; i < data.length; i++) {
    if (i > 4) {
      /* limits the number of bytes to a maximum of four */
      throw("Protocol error - remaining_length field too long");
    }
    length += (data[i] & 0x7F) * mul;
    mul *= 0x80;
    if (!(data[i] & 0x80)) {
      this.fixedHeader.remainingLength = length;
      this.fixedHeader.offset = i + 1;
      return;
    }
  }
  throw('Protocol error - no data');
};

/* decode the fixedHeader */
Decoder.prototype.decodeFixedHeader = function(data) {
  this.fixedHeader = {};
  this.decodeRemainingLength(data);
  this.fixedHeader.messageType = (data[0] & 0xF0) >> 4;
  this.fixedHeader.dup = ((data[0] & 0x08) === 0x08);
  this.fixedHeader.qos = (data[0] & 0x06) >> 1;
  this.fixedHeader.retain = ((data[0] & 0x01) !== 0);
};

Decoder.prototype.decode = function(data) {
  if (data.length < 2) {
    return {error: 'no data'};
  }
  this.decodeFixedHeader(data);
  var messageType = mqtt.MessageType[this.fixedHeader.messageType];
  if (!messageType) {
    throw('Protocol error - message type error');
  }
  this.fixedHeader.type = messageType;
  var message = messageDecode(this.fixedHeader, data);
  return message;
};

var messageDecode = function(fixedHeader, data) {
  var message = fixedHeader;
  var remainingLength = message.remainingLength;
  if (remainingLength + message.offset > data.length) {
    /* data not ready, waiting */
    return {status : 1};
  }
  var _count = message.offset;
  var decodeLength = function() {
    if (_count + 2 > data.length) {
      throw('Protocol error - error data');
    }
    var msb = data[_count++] & 0xFF; //remove sign extension due to casting
    var lsb = data[_count++] & 0xFF;
    msb = (msb << 8) | lsb ;
    return msb;
  };
  var decodeString = function() {
    var strLength = decodeLength();
    if (_count + strLength > data.length) {
      throw('Protocol error - error data');
    }
    var str = data.slice(_count, _count + strLength);
    _count += strLength;
    return str.toString('utf8');
  };
  var decoders = {
    /* CONNECT 0x01 */
    'CONNECT' : function() {
      if (remainingLength < 12) {
        throw('Protocol error - error data');
      }
      /* decode variable header begin */
      /* decode VERSION */
      var version = new Buffer(mqtt.VERSION);
      if (data.slice(_count, _count + version.length).toString('utf8') !== version.toString('utf8')) {
        message.error = 'invalid version';
        message.ack = 1;
        return message;
      }
      _count += version.length;

      /* username/password bit 7-6 */
      message.hasUsername = ((data[_count] & 0x80) !== 0);
      message.hasPassword = ((data[_count] & 0x40) !== 0);
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
      
      if (remainingLength == 12) {
        /* now need client id */
        message.ack = 2;
        return message;
      }
      
      /* decode payload begin */
      /* client id length */
      var clientId = decodeString();
      if (clientId.length > 23) {
        message.error = 'identifier rejected';
        message.ack = 2;
        return message;
      }
      message.clientId = clientId;
      
      /* will topic */
      if (message.willFlag) {
        var willTopic = decodeString();
        var willMessage = decodeString();
        message.willTopic = willTopic;
        message.willMessage = willMessage;
      }
      
      /* username/password */
      /* remaining length has precedence over the user and password flags */
      if (_count == remainingLength) {
        message.ack = 0;
        return message;
      }
      if (message.hasUsername) {
        var username = decodeString();
        message.username = username;
      }
      /* remaining length has precedence over the user and password flags */
      if (_count == remainingLength) {
        message.ack = 0;
        return message;
      }
      if (message.hasPassword) {
        var password = decodeString();
        message.password = password;
      }
      /* decode payload end */
      
      message.ack = 0;
      return message;
    },
    /* CONNACK 0x02 */
    'CONNACK' : function() {
      if(remainingLength != 2) {
        throw('Protocol error - error data');
      }
      _count++;
      message.ack = data[_count] & 0xFF;
      return message;
    },
    /* PUBLISH 0x03 */
    'PUBLISH' : function() {
      /* publish topic */
      message.topic = decodeString();
      /* message id */
      if (message.qos == 1 || message.qos == 2) {
        message.messageId = decodeLength();
      }
      message.payload = data.slice(_count, message.offset + remainingLength);
      return message;
    },
    /* PUBACK 0x04 */
    'PUBACK' : function() {
      message.messageId = decodeLength();
      return message;
    },
    /* PUBREC 0x05 */
    'PUBREC' : function() {
      message.messageId = decodeLength();
      return message;
    },
    /* PUBREL 0x06 */
    'PUBREL' : function() {
      message.messageId = decodeLength();
      return message;
    },
    /* PUBCOMP 0x07 */
    'PUBCOMP' : function() {
      message.messageId = decodeLength();
      return message;
    },
    /* SUBSCRIBE 0x08 */
    'SUBSCRIBE' : function() {
      if (message.qos != 1) {
        throw('Protocol error - qos should be 1');
      }
      if (data.length < _count + 2) {
        throw('Protocol error - error data');
      }
      message.messageId = decodeLength();
      message.topics = [];
      while (_count < remainingLength) {
        var topic = decodeString();
        if (_count < data.length) {
          var qos = data[_count++] & 0x03;
          message.topics.push({topic : topic, qos : qos});
        }
      }
      return message;
    },
    /* SUBACK 0x09 */
    'SUBACK' : function() {
      message.messageId = decodeLength();
      return message;
    },
    /* UNSUBSCRIBE 0x0a */
    'UNSUBSCRIBE' : function() {
      if (message.qos != 1) {
        throw('Protocol error - qos should be 1');
      }
      if (data.length < _count + 2) {
        throw('Protocol error - error data');
      }
      message.messageId = decodeLength();
      message.topics = [];
      while (_count < remainingLength) {
        var topic = decodeString();
        message.topics.push(topic);
      }
      return message;
    },
    /* UNSUBACK 0x0b */
    'UNSUBACK' : function() {
      message.messageId = decodeLength();
      return message;
    },
    /* PINGREQ 0x0c */
    'PINGREQ' : function() {
      return message;
    },
    /* PINGRESP 0x0d */
    'PINGRESP' : function() {
      return message;
    },
    /* DISCONNECT 0x0e */
    'DISCONNECT' : function() {
      return message;
    }
  };
  /* call the decode function */
  return decoders[message.type]();
};

module.exports.decode = function(data) {
  var decoder = new Decoder();
  return decoder.decode(data);
};
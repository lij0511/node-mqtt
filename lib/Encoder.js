var mqtt = require('./MQTT');

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
      var variableHeader = [0x00, message.code];
      var length = variableHeader.length;
      return fixedHeader.concat(length).concat(variableHeader);
    }
  };
  var encoder = encoders[type];
  if(!encoder) {
    throw("message type error");
  }
  return encoder();
};

module.exports.encode = function(message) {
  return messageEncode(message);
};
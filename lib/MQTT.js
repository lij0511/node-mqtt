module.exports = {

  /* version \00\06MQIsdp\03 */
  VERSION : [0x00,0x06,0x4D,0x51,0x49,0x73,0x64,0x70,0x03],
    
  /* FixedHeader */
  FixedHeader : function(messageType, dup, qos, retain) {
    return [ 0x00 | messageType * 0x10/* bits 7-4 */| dup * 0x08/* bits 3 */| qos * 0x02/* bits 2-1 */| retain/* bits 0 */];
  },

  /* MessageType */
  MessageType : {
    1 : 'CONNECT',
    2 : 'CONNACK',
    3 : 'PUBLISH',
    4 : 'PUBACK',
    5 : 'PUBREC',
    6 : 'PUBREL',
    7 : 'PUBCOMP',
    8 : 'SUBSCRIBE',
    9 : 'SUBACK',
    10 : 'UNSUBSCRIBE',
    11 : 'UNSUBACK',
    12 : 'PINGREQ',
    13 : 'PINGRESP',
    14 : 'DISCONNECT'
  },
  
  /* MessageCode */
  MessageCode : {
    'CONNECT' : 1,
    'CONNACK' : 2,
    'PUBLISH' : 3,
    'PUBACK' : 4,
    'PUBREC' : 5,
    'PUBREL' : 6,
    'PUBCOMP' : 7,
    'SUBSCRIBE' : 8,
    'SUBACK' : 9,
    'UNSUBSCRIBE' : 10,
    'UNSUBACK' : 11,
    'PINGREQ' : 12,
    'PINGRESP' : 13,
    'DISCONNECT' : 14
  }
  
};
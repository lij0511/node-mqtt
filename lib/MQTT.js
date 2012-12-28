module.exports = {

  /* FixedHeader */
  FixedHeader : function(messageType, dup, qos, retain) {
    return [ 0x00 | messageType * 0x10/* bits 7-4 */| dup * 0x08/* bits 3 */| qos * 0x02/* bits 2-1*/| retain/* bits 0*/];
  },

  /* MessageType */
  MessageType : {
    CONNECT : 1,
    CONNACK : 2,
    PUBLISH : 3,
    PUBACK : 4,
    PUBREC : 5,
    PUBREL : 6,
    PUBCOMP : 7,
    SUBSCRIBE : 8,
    SUBACK : 9,
    UNSUBSCRIBE : 10,
    UNSUBACK : 11,
    PINGREQ : 12,
    PINGRESP : 13,
    DISCONNECT : 14
  }
};
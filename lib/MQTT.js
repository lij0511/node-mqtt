var sys = require('sys');

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
  },
  
  mqttCommand : function(client, message) {
    var commands = {
      /* CONNECT 0x01 */
      'CONNECT' : function() {
        if (!client.sessionOpened) {
          /* ok */
          /* connect acknowledgment */
          var m = {type : 'CONNACK', ack : message.ack};
          client.sendMessage(m);
          if (message.ack === 0) {
            client._clientInfo = message;
            client.sessionOpened = true;
            if (message.clientId) {
              client._clientId = message.clientId;
              if (message.cleanSession) {
                client.clean();
              } else {
                process.nextTick(function() {
                  client.republish();
                });
              }
            } else {
            }
            client.emit('sessionOpened');
          } else {
            process.nextTick(function() {
              client.disconnect();
            });
          }
        }
      },
      /* CONNACK 0x02 */
      'CONNACK' : function() {
        if (!client.sessionOpened) {
          if (message.ack == 0) {
            client.sessionOpened = true;
            client.connecting = true;
            client.emit('sessionOpened');
            client.heartbeat();
          } else {
            sys.log('Connection refused by server');
            client.emit('openSessionFailed');
          }
        }
      },
      /* PUBLISH 0x03 */
      'PUBLISH' : function() {
        if (client.sessionOpened) {
          sys.log('publish message:messageId=' + message.messageId);
          sys.log('---------------:qos=' + message.qos);
          sys.log('---------------:dup=' + message.dup);
          sys.log('---------------:retain=' + message.retain);
          sys.log('---------------:topic=' + message.topic);
          sys.log('---------------:payload=' + message.payload.toString('utf8'));
          if(message.qos == 0) {
            client.onMessage(message);
          }
          if(message.qos == 1) {
            var m = {type : 'PUBACK', messageId : message.messageId};
            setTimeout(function() {
              client.sendMessage(m);
            }, 7000);
            
            client.onMessage(message);
          }
          if(message.qos == 2) {
            /* store message to qos2 */
            client._message.qos2(client._clientId, message);
            var m = {type : 'PUBREC', messageId : message.messageId};
            client.sendQos2(m);
          }
        }
      },
      /* PUBACK 0x04 */
      'PUBACK' : function() {
        /* publish acknowledgment */
        if (client.sessionOpened) {
          client._message.removeQos1(client._clientId, message.messageId);
          client.clearTimeout('PUBLISH_' + message.messageId);
        }
      },
      /* PUBREC 0x05 */
      'PUBREC' : function() {
        /* publish received */
        if (client.sessionOpened) {
          client.clearTimeout('PUBLISH_' + message.messageId);
          var m = {type : 'PUBREL', messageId : message.messageId};
          client.sendQos2(m);
        }
      },
      /* PUBREL 0x06 */
      'PUBREL' : function() {
        if (client.sessionOpened) {
          var m = {type : 'PUBCOMP', messageId : message.messageId};
          client.sendMessage(m);
          /* publish release */
          var msg = client._message.getQos2(client._clientId, message.messageId);
          if(msg) {
            client.onMessage(msg);
            client._message.removeQos2(client._clientId, message.messageId);
          }
          client.clearTimeout('PUBREC_' + message.messageId);
        }
      },
      /* PUBCOMP 0x07 */
      'PUBCOMP' : function() {
        if (client.sessionOpened) {
          /* publish complete */
          client._message.removeQos2(client._clientId, message.messageId);
          client.clearTimeout('PUBREL_' + message.messageId);
        }
      },
      /* SUBSCRIBE 0x08 */
      'SUBSCRIBE' : function() {
        if (client.sessionOpened) {
          for (var i = 0; i < message.topics.length; i++) {
            client._topic.subscribe(client._clientId, message.topics[i].topic, message.topics[i].qos);
          }
          /* unsubscribe acknowledgment */
          var m = {type : 'SUBACK', messageId : message.messageId, topics : message.topics};
          client.sendMessage(m);
        }
      },
      /* SUBACK 0x09 */
      'SUBACK' : function() {
        if (client.sessionOpened) {
          client.clearTimeout('SUBSCRIBE_' + message.messageId);
        }
      },
      /* UNSUBSCRIBE 0x0a */
      'UNSUBSCRIBE' : function() {
        if (client.sessionOpened) {
          for (var i = 0; i < message.topics.length; i++) {
            client._topic.unsubscribe(client._clientId, message.topics[i]);
          }
          /* unsubscribe acknowledgment */
          var m = {type : 'UNSUBACK', messageId : message.messageId, topics : message.topics};
          client.sendMessage(m);
        }
      },
      /* UNSUBACK 0x0b */
      'UNSUBACK' : function() {
        if (client.sessionOpened) {
          client.clearTimeout('UNSUBSCRIBE_' + message.messageId);
        }
      },
      /* PINGREQ 0x0c */
      'PINGREQ' : function() {
        if (client.sessionOpened) {
          var m = {type : 'PINGRESP'};
          client.sendMessage(m);
        }
      },
      /* PINGRESP 0x0d */
      'PINGRESP' : function() {
      },
      /* DISCONNECT 0x0e */
      'DISCONNECT' : function() {
        if (client.sessionOpened) {
          client.onSessionClosed();
        }
      }
    };
    commands[message.type]();
  }
};
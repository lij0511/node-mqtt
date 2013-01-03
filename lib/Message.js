
var Message = function() {
  this.qos1s = {};
  this.qos2s = {};
};

Message.prototype.qos2 = function(clientId, message) {
  if(!this.qos2s[clientId]) {
    this.qos2s[clientId] = {};
  }
  this.qos2s[clientId][message.messageId] = message;
};

Message.prototype.getQos2 = function(clientId, messageId) {
  var result = null;
  if(this.qos2s[clientId]) {
    result = this.qos2s[clientId][messageId];
    delete this.qos2s[clientId][messageId];
  }
  if(this.qos2s[clientId] == {}) {
    delete this.qos2s[clientId];
  }
  return result;
};

Message.prototype.qos1 = function(clientId, message) {
  if(!this.qos1s[clientId]) {
    this.qos1s[clientId] = {};
  }
  this.qos1s[clientId][message.messageId] = message;
};

Message.prototype.getQos1 = function(clientId, messageId) {
  var result = null;
  if(this.qos1s[clientId]) {
    result = this.qos1s[clientId][messageId];
    delete this.qos1s[clientId][messageId];
  }
  if(this.qos1s[clientId] == {}) {
    delete this.qos1s[clientId];
  }
  return result;
};

module.exports = Message;
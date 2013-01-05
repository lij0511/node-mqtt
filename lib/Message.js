
var Message = function() {
  this.qos1s = {};
  this.qos2s = {};
};

/**
 * store qos2 message
 * @param clientId
 * @param message
 */
Message.prototype.qos2 = function(clientId, message) {
  if (!this.qos2s[clientId]) {
    this.qos2s[clientId] = {};
  }
  this.qos2s[clientId][message.messageId] = message;
};

/**
 * get stored qos2 message
 * @param clientId
 * @param messageId
 */
Message.prototype.getQos2 = function(clientId, messageId) {
  var result = null;
  if (this.qos2s[clientId]) {
    result = this.qos2s[clientId][messageId];
  }
  return result;
};

/**
 * remove stored qos2 message
 * @param clientId
 * @param messageId
 */
Message.prototype.removeQos2 = function(clientId, messageId) {
  if (this.qos2s[clientId]) {
    delete this.qos2s[clientId][messageId];
  }
  if (this.qos2s[clientId] == {}) {
    delete this.qos2s[clientId];
  }
};

/**
 * republish stored qos2 message
 * @param clientId
 */
Message.prototype.republishQos2 = function(clientId) {
  return this.qos2s[clientId];
};

/**
 * store qos1 message
 * @param clientId
 * @param message
 */
Message.prototype.qos1 = function(clientId, message) {
  if (!this.qos1s[clientId]) {
    this.qos1s[clientId] = {};
  }
  this.qos1s[clientId][message.messageId] = message;
};

/**
 * get stored qos1 message
 * @param clientId
 * @param messageId
 */
Message.prototype.getQos1 = function(clientId, messageId) {
  var result = null;
  if (this.qos1s[clientId]) {
    result = this.qos1s[clientId][messageId];
  }
  return result;
};

/**
 * remove stored qos1 message
 * @param clientId
 * @param messageId
 */
Message.prototype.removeQos1 = function(clientId, messageId) {
  if (this.qos1s[clientId]) {
    delete this.qos1s[clientId][messageId];
  }
  if (this.qos1s[clientId] == {}) {
    delete this.qos1s[clientId];
  }
};

/**
 * republish stored qos1 message
 * @param clientId
 */
Message.prototype.republishQos1 = function(clientId) {
  return this.qos1s[clientId];
};

/**
 * clean session
 * @param clientId
 */
Message.prototype.clean = function(clientId) {
  if (this.qos1s[clientId]) {
    delete this.qos1s[clientId];
  }
  if (this.qos2s[clientId]) {
    delete this.qos2s[clientId];
  }
};

module.exports = Message;
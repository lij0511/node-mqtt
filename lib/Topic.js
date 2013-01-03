
var Topic = function(broker) {
  this._broker = broker;
  this._topics = {};
};

/**
 * subscribe topic
 * @param clientId
 * @param topic
 * @param qos
 */
Topic.prototype.subscribe = function(clientId, topic, qos) {
  if (!this._topics[topic]) {
    this._topics[topic] = {};
  }
  this._topics[topic][clientId] = qos;
};

/**
 * unsubscribe topic
 * @param clientId
 * @param topic
 */
Topic.prototype.unsubscribe = function(clientId, topic) {
  if (this._topics[topic]) {
    delete this._topics[topic][clientId];
  }
};

/**
 * publish message to subscribers
 * @param topic
 * @param message
 */
Topic.prototype.publish = function(topic, message) {
  if (this._topics[topic]) {
    for (clientId in this._topics[topic]) {
      var client = this._broker.getClient(clientId);
      if (!client) {
        /* client not online, store message to db */
        return;
      }
      client.publish(this._topics[topic][clientId], message);
    }
  }
};

/**
 * unsubscribe all
 * @param clientId
 */
Topic.prototype.clean = function(clientId) {
  /* unsubscribe all */
  for (topic in this._topics) {
    if (this._topics[topic][clientId]) {
      delete this._topics[topic][clientId];
    }
  }
  /* remove message from db */
};

module.exports = Topic;
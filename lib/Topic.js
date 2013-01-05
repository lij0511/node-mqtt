
var Topic = function(broker) {
  this._broker = broker;
  this._topics = {};
  this._retains = {};
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
  if(this._topics[topic][clientId] == undefined) {
    /* publish retain message */
    if(this._retains[topic]) {
      var client = this._broker.getClient(clientId);
      client.publish(qos, this._retains[topic]);
    }
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
        if (message.qos == 1) {
          this._broker._message.qos1(clientId, message);
        } else if (message.qos == 2) {
          this._broker._message.qos2(clientId, message);
        }
        continue;
      }
      client.publish(this._topics[topic][clientId], message);
    }
  }
};

Topic.prototype.retain = function(topic, message) {
  this._retains[topic] = message;
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
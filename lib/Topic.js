
var Topic = function(broker) {
  this._broker = broker;
  this._topics = {};
};

Topic.prototype.subscribe = function(clientId, topic, qos) {
  if (!this._topics[topic]) {
    this._topics[topic] = {};
  }
  this._topics[topic][clientId] = qos;
};

Topic.prototype.unsubscribe = function(clientId, topic) {
  if (this._topics[topic]) {
    delete this._topics[topic][clientId];
  }
};

Topic.prototype.publish = function(topic, message) {
  if (this._topics[topic]) {
    for (clientId in this._topics[topic]) {
      var client = this._broker.getClient(clientId);
      if(!client) {
        /* client not online, store message to db */
        return;
      }
      client.publish(this._topics[topic][clientId], message);
    }
  }
};

Topic.prototype.clean = function(clientId) {
  /* unsubscribe all */
  for(topic in this._topics) {
    if(this._topics[topic][clientId]) {
      delete this._topics[topic][clientId];
    }
  }
  /* remove message from db */
};

module.exports = Topic;
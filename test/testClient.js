var Client = require('../lib/Client');

var client = new Client({clientId : 'client1'});
client.on('sessionOpened', function() {
  client.subscribe('/topic');
});
client.on('message', function(topic, payload) {
  console.log(topic);
  console.log(payload.toString());
});
//
setTimeout(function() {
  client.publish('/topic', new Buffer('hello world'), 1, 0);
}, 3000);

//setTimeout(function() {
//  client.publish('/topic', new Buffer('hello world11'), 2, 0);
//}, 6000);
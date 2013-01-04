module.exports.genClientId = function(length) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  var result = "";
  var char_len = chars.length;
  var len = (length) ? length : 16;
  var rnum = 0;
  for (var i = 0; i < len; ++i) {
    rnum = Math.floor(Math.random() * char_len);
    result += chars[rnum];
  }
  return result;
};

module.exports.concat = function() {  
  var args = (arguments.length === 1) ? arguments[0] : arguments;  
  
  var i;  
  var sumlen = 0;  
  for (i = 0; i < args.length; i++) {  
    sumlen += args[i].length;  
  }  
  
  var buf = new Buffer(sumlen);  
  var pos = 0;  
  for (i = 0; i < args.length; i++) {  
    args[i].copy(buf, pos);  
    pos += args[i].length;  
  }  
  
  return buf;  
};  

module.exports.genMessageId = function(messageId) {
  return messageId & 0xFFFF;
};
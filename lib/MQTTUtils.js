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

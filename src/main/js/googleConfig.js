
var File = require("./File");

var configContent = new File("/home/remy/googleConfig.json").read();
var config = JSON.parse(configContent);

module.exports = config;
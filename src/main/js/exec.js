
var exec = require("child_process").exec;
var execFct = function (command) {
    console.log(command);
    exec(command, function (error, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        if (error !== null) {
          console.log('exec error: ' + error);
        }
    });
};

module.exports = execFct;
var static = require('node-static');

var fileServer = new static.Server('.', {
    cache: 1
});

var http = require('http');
var urlTools = require('url');
var myRequest = require('./myRequest');
var googleDrive = require("./googleDrive");
var googleAuth = require("./googleAuth");
var fileService = require("./fileService");
var utils = require("./utils");

var startsWith = function(string, start) {
    return string.length >= start.length && string.substring(0, start.length) === start;
}

http.createServer(function (request, response) {
    var url = request.url;
    var wrap = function(promise) {
        promise.then(function(res) {
            var result = typeof res === "object" ? utils.str(res) : (res + "");
            response.end(result);
        }).fail(function(e) {
            console.log(e.stack);
            response.end(e.stack);
        });
    };
    request.addListener('end', function () {
        var params = urlTools.parse(url, true).query;
        console.log(url);
        if (url === '/getAuthUrl') {
            wrap(googleAuth.getAuthUrl("http://localhost:8000/authCode"));
        } else if (startsWith(url, "/authCode")) {
            if (!params.code) {
                console.log(params);
                return;
            }
            wrap(googleAuth.retrieveAccessToken(params.code, "http://localhost:8000/authCode"));
        } else if (startsWith(url, "/sync")) {
            wrap(googleDrive.sync("/home/remy/Bureau/test", "sync_test", null));
        } else if (startsWith(url, "/file")) {
            wrap(googleDrive.getFile("sync_test/root.txt"));
        } else if (url === "/test") {
            response.end(JSON.stringify(fileService.crawl("/home/remy/Images/2014"), null, 2));
        } else {
            fileServer.serve(request, response);
        }
    }).resume();
}).listen(8000);
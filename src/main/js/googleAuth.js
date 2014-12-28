
var googleConfig = require("./googleConfig");
var myRequest = require("./myRequest");
var fileService = require("./fileService");
var exec = require("./exec");
var Q = require("./q");

var accessTokenFile = "/home/remy/accessToken";

var googleAuth = {
    getAuthUrl: function(redirectUrl) {
        var params = {
            response_type: "code",
            client_id: googleConfig.clientId,
            redirect_uri: redirectUrl,
            scope: "https://www.googleapis.com/auth/drive"
        };
        return myRequest.get("https://accounts.google.com/o/oauth2/auth", params).then(function(res) {
            var loc = res.headers.location;
            res.body = loc;
            exec("firefox \""+loc+"\"");
            return loc;
        });
    },
    retrieveAccessToken: function(code, redirectUrl) {
        var callParams = {
            code: code,
            client_id: googleConfig.clientId,
            client_secret: googleConfig.clientSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUrl
        };
        return myRequest.post("https://accounts.google.com/o/oauth2/token", callParams).then(function(res) {
            var json = JSON.parse(res.body);
            fileService.write(accessTokenFile, json.access_token);
            return json.access_token;
        });
    },
    getAccessToken: function() {
        return Q.value(fileService.readAsString(accessTokenFile));
    }
}

module.exports = googleAuth;
var Q = require("../../../node_modules/q/q");
var utils = require("./utils");

Q.value = function(value) {
    return Q.fcall(function() {
        return value;
    })
};

Q.empty = function() {
    return Q.value(undefined);
}

Q.failFct = function(message) {
    return function(e) {
        utils.stack(e, message);
    }
}

Q.chain = function(array, promiseFactory) {
    if (!array || !array.length) {
        return Q.value([]);
    }
    var lastPromise;
    utils.foreach(array, function(value) {
        var startPromise = lastPromise ? lastPromise : Q.value([]);
        lastPromise = startPromise.then(function(array) {
            return promiseFactory(value).then(function(result) {
                return array.concat([result]);
            });
        });
    });
    return lastPromise ? lastPromise : Q.value([]);
}

module.exports = Q;
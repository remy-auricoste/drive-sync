
var utils = {
    isArray: function(object) {
        return typeof object === "object" && (object.length || object.length === 0);
    },
    initObject: function(object) {
        if (this.isArray(object)) {
            return {
                result: [],
                add: function(value, key) {
                    this.result.push(value);
                }
            }
        } else {
            return {
                result: {},
                add: function(value, key) {
                    this.result[key] = value;
                }
            }
        }
    },
    foreach: function(object, fonction) {
        if (object.length) {
            for (var i=0;i<object.length;i++) {
                fonction(object[i], i);
            }
        } else {
            for (var key in object) {
                fonction(object[key], key);
            }
        }
    },
    map: function(object, fonction) {
        var helper = this.initObject(object);
        var result = helper.result;
        this.foreach(object, function(value, key) {
            helper.add(fonction(value, key), key);
        });
        return result;
    },
    filter: function(object, fonction) {
        return this.partition(object, fonction)[0];
    },
    partition: function(object, fonction) {
        var helper = this.initObject(object);
        var helperNot = this.initObject(object);
        var result = helper.result;
        var resultNot = helperNot.result;
        this.foreach(object, function(value, key) {
            var addedHelper = fonction(value, key) ? helper : helperNot;
            addedHelper.add(value, key);
        });
        return [result, resultNot];
    },
    flatten: function(array) {
        var result = [];
        this.foreach(array, function(value) {
            if (utils.isArray(value)) {
                result = result.concat(utils.flatten(value));
            } else {
                result.push(value);
            }
        });
        return result;
    },
    mkString: function(object, sep, start, end) {
        start = start ? start : "";
        end = end ? end : "";
        var result = start;
        var isFirst = true;
        this.map(object, function(value) {
            if (!isFirst) {
                result += sep;
            }
            isFirst = false;
            result += value;
        });
        return result + end;
    },
    stack: function(e, message) {
        var parent = e.message ? e.message : typeof e === "object" ? JSON.stringify(e, null, 2) : e;
        throw new Error(message+"\n"+parent);
    },
    str: function (object) {
        if (typeof object == "object") {
            var message = {};
            utils.foreach(object, function (value, key) {
                var tpe = typeof value;
                var newValue = value;
                if (tpe === "object") {
                   newValue = "{...}";
                } else if (tpe === "function") {
                   newValue = "function() {}";
                }
                message[key] = newValue;
            });
            return JSON.stringify(message, null, 2);
        } else {
            return object + "";
        }
    }
}

module.exports = utils;
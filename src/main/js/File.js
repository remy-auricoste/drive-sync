
var fs = require("fs");
var MD5 = require("MD5");

var File = function(path) {
    if (!path) {
        throw new Error("cannot create file for "+path);
    }
    this.path = path;
}

File.prototype.getParts = function() {
    var index = this.path.lastIndexOf('/');
    if (index < 0) {
        return [null, this.path];
    }
    return [this.path.substring(0, index), this.path.substring(index + 1)];
}

File.prototype.getLeaf = function() {
    return this.getParts()[1];
}

File.prototype.getExtension = function() {
    var leaf = this.getLeaf();
    var index = leaf.lastIndexOf('.');
    if (index < 0) {
        return null;
    } else {
        return leaf.substring(index + 1);
    }
}

File.prototype.getParentPath = function() {
    return this.getParts()[0];
}

File.prototype.getParent = function() {
    if (!this.getParentPath()) {
        return null;
    }
    return new File(this.getParentPath());
}

File.prototype.getModifiedDate = function() {
    return fs.statSync(this.path).mtime;
}

File.prototype.exists = function() {
    return fs.existsSync(this.path);
}

File.prototype.read = function() {
    return fs.readFileSync(this.path);
}

File.prototype.md5 = function() {
    return MD5(this.read());
}

module.exports = File;

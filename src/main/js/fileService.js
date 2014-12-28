
var fs = require("fs");
var utils = require("./utils");

var fileService = {
    crawl: function(path) {
        var list = fs.readdirSync(path);
        var array = utils.map(list, function(filename) {
            if (filename.indexOf('.') >= 0) {
                return filename;
            } else {
                var subFiles = fileService.crawl(path + "/" + filename);
                return utils.map(subFiles, function(subFile) {
                    return filename + "/" + subFile;
                });
            }
        });
        return utils.flatten(array);
    },
    write: function(path, content) {
        try {
            fs.writeFileSync(path, content);
        } catch(e) {
            utils.stack(e, "could not write to file '"+path+"'");
        }
    },
    read: fs.readFileSync,
    readAsString: function(path) {
        return fs.readFileSync(path, {
            encoding: "UTF-8"
        });
    }
}

module.exports = fileService;
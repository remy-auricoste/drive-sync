
var myRequest = require("./myRequest");
var fileService = require("./fileService");
var urlTools = require('url');
var googleConfig = require("./googleConfig");
var googleAuth = require("./googleAuth");
var File = require("./File");
var utils = require("./utils");
var Q = require("./q");
var moment = require("moment");
var MD5 = require("MD5");

var endsWith = function(string, end) {
    return string.substring(string.length - end.length) === end;
}

var mimeMap = {
    jpg: "image/jpeg",
    txt: "text/plain"
}

var parseDate = function(dateString) {
    var momentDate = moment(dateString, "YYYY-MM-DDTHH:mm:ss.SSSZ");
    return new Date(momentDate.milliseconds());
}

var googleDrive = {
    upsert: function(filepath, drivePath, fileId) {
        return Q.fcall(function() {
            var file = new File(filepath);
            var ext = file.getExtension();
            var mimeType = mimeMap[ext];
            if (!mimeType) {
                throw new Error("file extension not supported : "+filepath);
            }
            var fileIdPromise = fileId ? Q.value(fileId) : googleDrive.getFile(drivePath+"/"+file.getLeaf()).then(function(res) {
                return (res && res.id) ? res.id : null;
            });
            var dirIdPromise = googleDrive.getDir(drivePath).then(function(res) {
                return (res && res.id) ? res.id : null;
            });
            var accessTokenPromise = googleAuth.getAccessToken();
            return Q.all([accessTokenPromise, fileIdPromise, dirIdPromise]).then(function(array) {
                var accessToken = array[0];
                var fileId = array[1];
                var dirId = array[2];

                var localFile = new File(filepath);
                var contentFile = localFile.read();
                var postParams = {
                    title: file.getLeaf(),
                    description: MD5(contentFile)
                }
                if (dirId) {
                    postParams.parents = [{id: dirId}];
                }
                var contentTotal = contentFile.length;
                var url = "https://www.googleapis.com/upload/drive/v2/files";
                if (fileId) {
                    url = url + "/" + fileId;
                }
                var method = fileId ? "PUT" : "POST";
                var options = {
                    method: method,
                    url: url,
                    getParams: {
                       access_token: accessToken,
                       uploadType: "resumable",
                    },
                    postParams: JSON.stringify(postParams, null, 2),
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                        "X-Upload-Content-Type": mimeType,
                        "X-Upload-Content-Length": contentTotal
                    }
                }
                console.log("uploading file as resumable "+filepath);
                return myRequest.call(options).then(function(res) {
                    var loc = res.headers.location;
                    var uploadId = urlTools.parse(loc, true).query.upload_id;
                    var options = {
                        method: "PUT",
                        url: url,
                        getParams: {
                           access_token: accessToken,
                           uploadType: "resumable",
                           upload_id: uploadId
                        },
                        headers: {
                            "Content-Type": mimeType
                        }
                    }
                    var recCall = function(start, total, inc) {
                        var end = Math.min(total, start + inc);
                        options.headers["Content-Range"] = "bytes "+start+"-"+(end-1)+"/"+total;
                        options.postParams = contentFile.slice(start, end);
                        console.log("sending "+options.headers["Content-Range"]+", size="+options.postParams.length);
                        return myRequest.call(options).then(function(res) {
                            if (end < total - 1) {
                                return recCall(end, total, inc);
                            } else {
                                return res;
                            }
                        });
                    };
                    return recCall(0, contentTotal, 1024*1024);
                });
            });
        }).fail(Q.failFct("cannot upsert "+filepath+" into "+drivePath));
    },
    insert: this.upsert,
    update: this.upsert,
    download: function(drivePath, localPath) {
        return this.getFile(drivePath).then(function(fileObject) {
            if (!fileObject) {
                throw new Error("the file '"+drivePath+"' does not exist");
            }
            var localFile = new File(localPath);
            var driveDate = parseDate(fileObject.modifiedDate);
            if (localFile.exists()) {
                var localDate = localFile.getModifiedDate();
                if (localDate.getTime() >= driveDate.getTime() || fileObject.description === localFile.md5()) {
                    return false;
                }
            }
            console.log("downloading "+drivePath+" to directory "+localPath);
            var downloadUrl = fileObject.downloadUrl;
            return googleAuth.getAccessToken().then(function(accessToken) {
                return myRequest.get(downloadUrl+"&access_token="+accessToken).then(function(res) {
                    fileService.write(localPath, res.body);
                    return true;
                });
            });
        }).fail(Q.failFct("cannot download "+drivePath+" into "+localPath));
    },
    syncUp: function(localPath, drivePath, date) {
        var filePaths = fileService.crawl(localPath);
        return Q.chain(filePaths, function(path) {
            try {
                var relativeFile = new File(path);
                var driveFullPath = drivePath;
                if (relativeFile.getParentPath()) {
                  driveFullPath += "/" + relativeFile.getParentPath();
                }
                return googleDrive.mkDirs(driveFullPath).then(function() {
                    var driveFile = new File(driveFullPath+"/"+relativeFile.getLeaf());
                    return googleDrive.getFile(driveFile.path).then(function(fileObject) {
                        var localFile = new File(localPath+"/"+path);
                        var fileId;
                        if (fileObject) {
                            fileId = fileObject.id;
                            var driveDate = parseDate(fileObject.modifiedDate);
                            var localDate = localFile.getModifiedDate();
                            if (driveDate.getTime() >= localDate.getTime() || fileObject.description === localFile.md5()) {
                                return false;
                            }
                        }
                        return googleDrive.upsert(localFile.path, driveFullPath, fileId);
                    });
                });
            } catch(e) {
                throw new Error("could not upsert "+path+" found in "+localPath+".\n"+e.message);
            }
        }).then(function(array) {
            return utils.filter(array, function(value) {
                return value !== false;
            }).length;
        });
    },
    syncDown: function(drivePath, localPath, date) {
        return googleDrive.crawl(drivePath).then(function(paths) {
            return Q.chain(paths, function(path) {
                return googleDrive.download(path, localPath+"/"+path);
            }).then(function(array) {
                return utils.filter(array, function(downloaded) {
                    return downloaded === true;
                }).length;
            });
        }).fail(Q.failFct("cannot syncDown "+drivePath+" into "+localPath+" starting from date "+date));
    },
    sync: function(localPath, drivePath, date) {
        return this.syncDown(drivePath, localPath, date).then(function(numberDown) {
            return googleDrive.syncUp(localPath, drivePath, date).then(function(numberUp) {
                return {
                    up: numberUp,
                    down: numberDown
                };
            });
        });
    },
    search: function(addedFilters) {
        if (!addedFilters) {
            addedFilters = [];
        }
        var filters = [
            "trashed = false"
        ].concat(addedFilters);
        return googleAuth.getAccessToken().then(function(accessToken) {
            var params = {
                 q: utils.mkString(filters, " and "),
                 access_token: accessToken
            };
            return myRequest.get("https://www.googleapis.com/drive/v2/files", params).then(function(res) {
                try {
                    var items = JSON.parse(res.body).items;
                    if (!items) {
                        throw new Error("could not get field items from body response : "+res.body);
                    }
                    return items;
                } catch(e) {
                    throw new Error("could not retrieve search results for query "+params.q+"\n"+e.message);
                }
            });
        });
    },
    searchFirst: function(addedFilters) {
        return this.search(addedFilters).then(function(res) {
            return res.length ? res[0] : null;
        });
    },
    getDir: function(path) {
        var filters = ["mimeType = 'application/vnd.google-apps.folder'"];
        return this.getFile(path, filters);
    },
    getFile: function(path, addedFilters) {
        if (!addedFilters) {
            addedFilters = [];
        }
        return Q.fcall(function() {
            var file = new File(path);
            var parts = file.getParts();
            var dirName = parts[1];
            var parentDir = parts[0];
            var filters = [
                "title = '"+dirName+"'"
            ].concat(addedFilters);

            var startPromise = Q.empty();
            if (parentDir) {
                startPromise = googleDrive.getDir(parentDir).then(function(res) {
                    if (!res) {
                        throw new Error("could not find directory "+parentDir+" in google drive");
                    }
                    filters.push("'"+res.id+"' in parents");
                });
            }
            return startPromise.then(function() {
                return googleDrive.searchFirst(filters);
            });
        }).fail(Q.failFct("cannot get file "+path+" in google drive"));
    },
    crawl: function(path) {
        return this.getDir(path).then(function(res) {
            if (!res) {
                throw new Error("no directory found for path "+path);
            }
            var filters = [
                 "'"+res.id+"' in parents"
            ];
            return googleDrive.search(filters).then(function(fileObjects) {
                var partitions = utils.partition(fileObjects, function(fileObject) {
                    return fileObject.mimeType === "application/vnd.google-apps.folder"
                });
                var dirs = partitions[0];
                var files = partitions[1];
                var fileTitles = utils.map(files, function(file) {
                    return file.title;
                });
                return Q.chain(dirs, function(dirObject) {
                    return googleDrive.crawl(path + "/" + dirObject.title).then(function(subFilenames) {
                        return utils.map(subFilenames, function(name) {
                            return dirObject.title + "/" + name;
                        });
                    });
                }).then(function(subFilenames) {
                    return fileTitles.concat(utils.flatten(subFilenames));
                });
            });
        });
    },
    mkDirs: function(path) {
        var file = new File(path);
        return googleDrive.getDir(path).then(function(dirObject) {
            if (dirObject) {
                return dirObject;
            } else {
                return googleAuth.getAccessToken().then(function(accessToken) {
                    return googleDrive.mkDirs(file.getParentPath()).then(function(parentDirObject) {
                        var postParams = {
                            title: file.getLeaf(),
                            parents: [{"id":parentDirObject.id}],
                            mimeType: "application/vnd.google-apps.folder"
                        };
                        var options = {
                            method: "POST",
                            url: "https://www.googleapis.com/drive/v2/files",
                            getParams: {
                               access_token: accessToken
                            },
                            postParams: JSON.stringify(postParams, null, 2),
                            headers: {
                                "Content-Type": "application/json; charset=UTF-8"
                            }
                        }
                        console.log("creating directory on drive : "+path);
                        return myRequest.call(options).then(function(res) {
                            console.log("result mkdirs");
                            console.log(res.body);
                            return JSON.parse(res.body);
                        }).fail(Q.failFct("could not create directory "+path));
                    });
                });
            }
        });
    }
}

module.exports = googleDrive;
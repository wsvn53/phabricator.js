/**
 * Requires.
 */
var Class = require("arale").Class,
    http = require("http"),
    jsonpath = require("JSONPath"),
    fs = require("fs"),
    url = require("url"),
    sha1 = require('sha1'),
    PhabricatorBase = require("./base");

/**
 * Main class.
 * Phabricator @ 2013.09.05
 */
var Phabricator = PhabricatorBase.extend({
    // certificate file
    certificate_file : __dirname + "/certificate.json",
    initialize : function (options) {
        Phabricator.superclass.initialize.call(this, options);
    }, 
    /**
     * like : arc install-certificate
     * @param `token`    - String, token from <http://{phabricator_host}/conduit/token/>.
     * @param `callback` - Function, callback function.
     */
    installCertificate : function (token, callback) {
        var that = this;
        // conduit.ping first
        this.execute("conduit.ping", null, function (data) {
            // if data.result
            if (!!data.result) {
                that.execute("conduit.getcertificate", {
                    "token" : token
                }, function (data) {
                    if (!!data.result) {
                        // save to certificate.json
                        fs.writeFileSync(that.certificate_file, JSON.stringify(data.result));
                        callback(data);
                    } else {
                        callback(data);
                    }
                });
            } else {
                callback(data);
            }
        });
    },
    /**
     * execute `conduit.connect`
     * @param `callback` - Function, callback function.
     */
    connect : function (callback) {
        var token = parseInt(new Date().getTime() / 1000);
        if (fs.existsSync(this.certificate_file)) {
            var cert_info = JSON.parse(fs.readFileSync(this.certificate_file).toString());
            this.execute("conduit.connect", {
                client : this.config.client,
                clientVersion : this.config.client_version,
                clientDescription : "Phabricator api client for Node.",
                user : cert_info.username || "",
                authSignature: sha1(token + cert_info.certificate),
                authToken: token
            }, function (result) {
                callback(result);
            });
        } else {
            callback({
                result : null,
                error_code : "ERR-JS-NOCERTIFICATE",
                error_info : "No certificate.json found. Execute `installCertificate` first."
            });
        }
    },
    /**
     * @param `callback` - Function, callback function.
     */
    list : function (callback) {
        var that = this;
        this.connect(function (data) {
            if (!!data.result) {
                /**
                 * execute differential.query
                 */
                that.execute ("differential.query", {
                    authors : [data.result.userPHID],
                    status : "status-open",
                    "__conduit__" : {
                        sessionKey : data.result.sessionKey,
                        connectionID : data.result.connectionID
                    }    
                }, function (data) {
                    callback (data);
                });
            } else {
                callback (data);
            }
        });
    },
    /**
     * execute `differential.createrawdiff`
     * create diff from diff raw
     * @param `diff`     - String, diff raw string.
     * @param `callback` - Function, callback function.
     */
    createRawDiff : function (diff, callback) {
        var that = this;
        this.connect(function(res) {
            if (!!res.result) {
                that.execute("differential.createrawdiff", {
                    diff : diff,
                    authors : [res.result.userPHID],
                    status : "status-open",
                    "__conduit__" : {
                        sessionKey : res.result.sessionKey,
                        connectionID : res.result.connectionID
                    } 
                }, function (data) {
                    callback (data);
                });
            } else {
                callback (res);
            }
        });
    },
    /**
     * create raw diff from diff file
     * @param `path`     - String, diff file path.
     * @param `callback` - Function, callback function.
     */
    createRawDiffFromFile : function (path, callback) {
        if (fs.existsSync(path)) {
            var diff = fs.readFileSync(path).toString();
            this.createRawDiff(diff, callback);
        } else {
            callback({
                result : null,
                error_code : "ERR-JS-DIFF_FILE_NOT_EXISTS",
                error_info : "Diff file `" + path + "` not exsits."
            })
        }
    },
    /**
     * create revision for diff id
     * @param `diff_id`  - Integer, remote diff id.
     * @param `callback` - Function, callback function.
     */
    createRevisionForDiffID : function (diff_id, callback) {
        // body...
    },
    /**
     * create revision from diff raw
     * @param `diff`     - String, diff raw string.
     * @param `callback` - Function, callback function.
     */
    createRevisionFromDiffRaw : function (diff, callback) {
        // body...
    },
    /**
     * create revision from diff file
     * @param `path`     - String, diff file path.
     * @param `callback` - Function, callback function.
     */
    createRevisionFromDiffFile : function (path, callback) {
        // body...
    }
});

module.exports.new = function (config) {
    return new Phabricator(config);
};
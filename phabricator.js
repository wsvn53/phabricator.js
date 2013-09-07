/**
 * Requires.
 */
var Class = require("arale").Class,
    http = require("http"),
    jsonpath = require("JSONPath"),
    fs = require("fs"),
    url = require("url"),
    sha1 = require('sha1');

/**
 * Main class.
 * Phabricator @ 2013.09.05
 */
var Phabricator = Class.create({
    config : {
        conduit_uri : "https://secure.phabricator.com/",
        output : "json",
        proxy : false
    },
    version : "",
    interfaces : null,
    interface_file : __dirname + "/interfaces.json",
    // store token for this app
    config_file : __dirname + "/phabricator.json",
    // certificate file
    certificate_file : __dirname + "/certificate.json",
    // http request default options
    http_options : {
        port: 80,
        method: 'POST'
    },
    initialize : function (options) {
        // read package info
        if (fs.existsSync(__dirname + "/package.json")) {
            var pg = JSON.parse(fs.readFileSync(__dirname + "/package.json").toString());
            this.version = pg.version;
        }
        // parse interfeces
        if (!fs.existsSync(this.interface_file)) {
            throw "No `interfeces.json` found. Please use `tools/gen_api_interfaces.php` to generate it.";
            return null;
        }
        this.interfeces = JSON.parse(fs.readFileSync(this.interface_file));
        // read config
        for (var opt in options) {
            this.config[opt] = options[opt];
        }
        // delete the last '/'
        if(this.config.conduit_uri.charAt(this.config.conduit_uri.length-1)=="/") 
            this.config.conduit_uri = this.config.conduit_uri.substr(0, this.config.conduit_uri.length-1);
        // read proxy
        if (!!this.config.proxy) {
            var proxy_info = this.config.proxy.split(":");
            this.config.proxy_host = proxy_info[0];
            this.config.proxy_port = proxy_info[1];
        }
    }, 
    /**
     * set local `phabricator.json` config file
     */
    setConfig : function (configName, configValue) {
        // body...
    },
    /**
     * Main request to API url.
     */
    request : function (rule, data, callback) {
        var that = this,
            api_url = url.parse(this.config.conduit_uri),
            port_map = {
                "http:" : "80",
                "https:" : "443"
            },
            options = {
                hostname : this.config.proxy_host || api_url.host,
                port : this.config.proxy_port || api_url.port || port_map[api_url.protocol] || this.http_options.port,
                path : (!!this.config.proxy?this.config.conduit_uri:"") + ("/api/" + rule.name),
                headers : {
                    "Host" : api_url.host,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method : rule.method || this.http_options.method
            },
            http_req = http.request(options, function (res) {
                // console.log('STATUS: ' + res.statusCode);
                // console.log('HEADERS: ' + JSON.stringify(res.headers));
                res.setEncoding('utf8');
                var responseText = "";
                res.on('data', function (chunk) {
                    responseText += chunk;
                });
                res.on("end", function () {
                    var result = that.config.output=="json"?JSON.parse(responseText):responseText;
                    if (typeof result=="object") result.apiName = rule.name;
                    callback(result);
                });
            });
        
        var post_data = [];
        post_data.push("output=" + this.config.output);
        post_data.push("__conduit__=1");
        var post_params = {};
        // build `required` parameters
        if(!(rule.required instanceof Array)) {
            for (var key in rule.required) {
                if((!!data&&key in data)&&!!data[key]){
                    // var value = rule.required[key]=="str"?encodeURIComponent(data[key]):data[key];
                    post_params[key] = data[key];
                } else {
                    throw "Error: api name `" + rule.name + "` require this parameter `" + key + "`.";
                }
            }
        } 
        // build `optional` parameters
        if(!(rule.optional instanceof Array)&&!!data) {
            for (var key in rule.optional) {
                if(key in data){
                    // var value = rule.optional[key]=="str"?encodeURIComponent(data[key]):data[key];
                    post_params[key] = data[key];
                }
            }
        }
        // add __conduit__ meta
        if ("__conduit__" in data) post_params["__conduit__"] = data["__conduit__"];
        // console.log(post_params)
        post_data.push("params=" + encodeURIComponent(JSON.stringify(post_params)));
        // console.log(post_data)

        http_req.write(post_data.join("&"));
        http_req.end();
    },
    /**
     * find apiName like `conduit.ping`
     * @return interface rule object
     */
    find : function (apiName) {
        return jsonpath.eval(this.interfeces, "$." + apiName)[0];
    },
    /**
     * read config form file 'phabricator.json'
     */
    _readConfigFile : function () {
        if (fs.existsSync(this.config_file)) {
            return JSON.parse(fs.readFileSync(this.config_file));
        } else {
            return {};
        }
    },
    /**
     * some common data here.
     */
    _generateData : function (data) {
        if (!data) data = {};
        var local_config = this._readConfigFile(),
            out_data = {
                host : data.host || this.config.conduit_uri + "/api/"
            };

        // Priority 1, use user defined data
        for(var key in data) {
            if (!(key in out_data)) out_data[key] = data[key];
        }

        for (var key in local_config) {
            if (!(key in out_data)) out_data[key] = local_config[key];
        } 

        return out_data;
    },
    /**
     * main execute function
     * @param `apiName`  - String, api name like `conduit.ping`.
     * @param `data`     - Object, will use this data to combine parameters.
     * @param `callback` - Function, callback function.
     */
    execute : function (apiName, data, callback) {
        // execute by api rule in interfaces
        var rule = this.find(apiName);
        if (!!rule) {
            rule.name = apiName;
            this.request(rule, this._generateData(data), callback);
        } else {
            callback({
                result : null,
                error_code : "ERR-JS-NOCOMMAND",
                error_info : "Cann't find any command named `" + apiName + "` to execute!"
            });
        }
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
                client : "Phabricator.js",
                clientVersion : this.version,
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

exports.new = function (config) {
    return new Phabricator(config);
};
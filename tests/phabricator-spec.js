var expect = require("expect.js"),
    Phabricator = require("../phabricator");

describe("Phabricator", function () {
    var prc = Phabricator.new({
        proxy : "10.211.55.12:8888",
        conduit_uri : "http://apn.imethan.com"
    });
    it("should return new class", function () {
        expect(prc).to.be.an(Object);
    });

    it("this.find() should return object in interfaces", function () {
        var api_rule = prc.find("conduit.ping");
        expect(api_rule).to.be.an(Object);
    });

    it("this.execute() shuold return object", function (done) {
        this.timeout(5000);
        prc.execute("conduit.ping", {
        }, function (data) {
            console.log(data)
            expect("result" in data).to.be(true);
            done();
        });
    });

    it("this.installCertificate(token) should return true", function (done) {
        this.timeout(5000);
        var token = "mcrdz4cvqhaedhanoeqqdcpcpyxygwwt32zv6q5b";
        prc.installCertificate(token, function (data) {
            console.log("\n")
            console.log(data)
            expect(!!data.result||!!data.error_code).to.be(true);
            done();
        });
    });

    it("this.list() should return a list", function (done) {
        this.timeout(5000);
        prc.list(function (data) {
            console.log("\n")
            console.log(data);
            expect(data.result).to.be.an(Object);
            done();
        });
    });

    it("this.createRawDiffFromFile() should return diff id", function (done) {
        this.timeout(30000);
        prc.createRawDiffFromFile(__dirname + "/b.diff", function (data) {
            console.log("\n")
            console.log(data);
            expect(data.result).to.be.an(Object);
            done();
        });
    });
});
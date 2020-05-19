var fs = require('fs');
var path = require('path');
var pagedown = require("pagedown");
var sanitizer = require("sanitize-html");
var path = require("path");
var git = require("./cwikgit");
var config = require("./config");
var PUSH_BRANCHES = config.PUSH_BRANCHES;
var UPSTREAM_REPO_NAME = config.UPSTREAM_REPO_NAME;
var REPO_BRANCH_NAME = config.REPO_BRANCH_NAME;

var ncp = require('ncp').ncp;
ncp.limit = 16; // number of simultaneous copy operations allowed

var titles = ["h1", "h2", "h3", "h4", "h5", "h6"]

/* Turns a wiki path into a link */
function WikiLinkify(s) {
    var text = s.split("/").slice(-1)[0].replace("__", " ")
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3)
    return '<a class="histL" href=\"' + s + '">' + text + '</a>'
}

/* Creates a js-handled link to an anchor i.e. # -- an internal link to a different document section.  Click calls the client-side js function jumpTo. */
function JumpToLinkify(s, cls) {
    var text = s.split("/").slice(-1)[0].replace("__", " ");
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3);
    //return '<a class="histL" href=\"' + s + '">' + text + '</a>'
    var ret = '<div class="l' + cls + '"></span><span class="i' + cls + '" onclick="jumpTo(\'' + text + '\')">' + text + "</span></div>\n";
    console.log(ret)
    return ret;
}

/* Creates a js-handled link to another document.  Click calls the client-side js function "linkTo" */
function LinkToLinkify(s, cls) {
    var text = s.split("/").slice(-1)[0].replace("__", " ");
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3);
    //return '<a class="histL" href=\"' + s + '">' + text + '</a>'
    var ret = '<div class="l' + cls + '"></span><span class="i' + cls + '" onclick="linkTo(\'' + text + '\')">' + text + "</span></div>\n";
    console.log(ret)
    return ret;
}


function BadURL(req, res) {
    res.status(404).send('Sorry, we cannot find that!')
}


// Return a requested page
handleAPage = function(req, res) {
    var notification = undefined;
    var userSpace = "";
    var readFrom = contentHome;
    if (req.session.uid == undefined) {
        // For now, require login
        // return res.redirect(307,"/_login_")
    } else {
        userSpace = config.USER_FORK_ROOT + "/" + req.session.uid.split(":")[1];
        readFrom = userSpace;
        console.log("User space: " + userSpace);

        // Make a working space for this user if one does not yet exist
        if (!fs.existsSync(userSpace)) {
            // Refresh my local copy
            git.pull(contentHome, UPSTREAM_REPO_NAME, REPO_BRANCH_NAME,
                function(err, oid) {
                    if (err != null) console.log("pull " + contentHome + " error " + err);

                    // then copy it to the user's space
                    ncp(contentHome, userSpace, function(err) {
                        if (err) {
                            return console.error("ncp copy error: " + err);
                        }
                        console.log("user scratch space created!");
                    });
                });
            readFrom = contentHome; // While I'm waiting for the copy, allow the user to read
        }

        if (git.changedFiles[req.session.uid] == undefined) {
            git.loadChangedFiles(req.session.uid, req.session);
        }

    }

    console.log("handle a page: " + req.path);
    console.log("url: " + req.baseUrl);
    console.log("hostname: " + req.hostname);
    console.log("originalUrl: " + req.originalUrl);

    if (req.path == "/favicon.ico") {
        res.sendFile("public/images/icon.ico");
        return;
    }

    urlPath = req.path;
    console.log(urlPath);
    console.log(decodeURI(urlPath));
    decodedPath = decodeURI(urlPath);
    decodedPath = decodedPath.replace(" ", "__"); // replace spaces with double underscore
    decodedPath = decodedPath.toLowerCase(); // wiki pages are not case sensitive
    if (decodedPath.startsWith(".")) return BadURL(req, res); // Don't allow overwriting dot files
    if (decodedPath.includes("..")) return BadURL(req, res);
    if (decodedPath == "/") decodedPath = "/home"; // hard code / to home.md
    if (decodedPath.endsWith("/")) decodedPath = decodedPath.substring(0, decodedPath.length - 1);
    var filepath = readFrom + decodedPath; //  + ".md";
    if (!filepath.endsWith(".md")) {
        filepath = filepath + ".md";
    }
    console.log("access " + filepath);

    if (req.method == "POST") {
        var repoRelativeFilePath = decodedPath.slice(1);

        if (!repoRelativeFilePath.endsWith(".md")) {
            repoRelativeFilePath = repoRelativeFilePath + ".md";
        }

        var writeFilePath = userSpace + repoRelativeFilePath;
        // requires app.use(bodyParser.text({type: 'text/plain'}));
        // console.log(writeFilePath + ": POST of " + JSON.stringify(req.body));
        console.log("user: " + req.session.uid);
        if (req.session.uid == undefined) {
            res.json({
                notification: "unauthorized edit attempt, log in first!"
            });
            return;
        }

        var chFiles = git.changedFiles[req.session.uid];

        if (!chFiles.has(repoRelativeFilePath)) {
            chFiles.add(repoRelativeFilePath);
            git.saveChangedFiles(req.session.uid, chFiles);
        }

        var dirOfPost = path.dirname(filepath);
        if (!fs.existsSync(dirOfPost))
            fs.mkdirSync(dirOfPost, {
                recursive: true
            });

        fs.writeFile(filepath, req.body, (err) => {
            if (err) {
                console.log("POST content file write error: " + err.message);
                res.json({
                    notification: err.message
                });
            } else {
                console.log("file write success");
                res.send("ok");
            }
        });
        return;
    }

    console.log("read file: " + filepath);
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) {
            data = "";
            notification = "nonexistent page, click 'edit' to create";
            var user = {
                loggedIn: (req.session.uid != undefined) ? true : false
            };

            if (req.query.json) {
                console.log("trying " + readFrom + "/cwikTemplate.html");
                return fs.readFile(readFrom + "/cwikTemplate.html", 'utf8', function(err, htmlTemplateData) {
                    if (err) {
                        console.log("template missing");
                        return res.json({
                            zzwikiPage: "",
                            structure: "",
                            title: "",
                            related: "",
                            thisPage: urlPath,
                            rawMarkdown: "",
                            history: updateHistory(req, urlPath),
                            user: user,
                            notification: notification,
                            STACKEDITOR_URL: config.STACKEDIT_URL
                        });
                    }
                    console.log("template exists");
                    return res.json({
                        html: htmlTemplateData,
                        zzwikiPage: "",
                        structure: "",
                        title: "",
                        related: "",
                        thisPage: urlPath,
                        rawMarkdown: "",
                        history: updateHistory(req, urlPath),
                        user: user,
                        notification: notification,
                        STACKEDITOR_URL: config.STACKEDIT_URL
                    });

                });
            } else
                return res.render('wikibrowse', {
                    zzwikiPage: "",
                    structure: '',
                    title: "",
                    related: "",
                    thisPage: urlPath,
                    rawMarkdown: "",
                    history: updateHistory(req, urlPath),
                    user: user,
                    notification: notification,
                    STACKEDITOR_URL: config.STACKEDIT_URL
                });
        }

        if (req.query.raw) {
            //console.log("RAW:" + data);
            res.send(data);
            return;
        }

        var doc = data;

        var htmlFile = filepath.slice(0, filepath.length - 2) + "html";
        // console.log("HTML file is: " + htmlFile);
        var regenerate = false;
        try {
            var htmlFileStats = fs.statSync(htmlFile);
            var mdFileStats = fs.statSync(filepath);
            console.log("Times: html: " + htmlFileStats.mtime + "md: " + mdFileStats.mtime);
            if (htmlFileStats.mtime <= mdFileStats.mtime) regenerate = true;
        } catch (err) {
            regenerate = true;
        }

        if (regenerate) {
            // Convert markdown to html
            console.log("regenerate " + htmlFile);
            mdToHtml(doc).then(html => {
                fs.writeFile(htmlFile, html, function(err) {
                    console.log("write error: " + err);
                })
                wikiPageReplyWithMdHtml(req, res, doc, html, urlPath);
            });
        } else {
            fs.readFile(htmlFile, 'utf8', function(err, html) {
                if (err) {
                    mdToHtml(doc).then(html => {
                        wikiPageReplyWithMdHtml(req, res, doc, html, urlPath);
                    });
                } else {
                    wikiPageReplyWithMdHtml(req, res, doc, html, urlPath);
                }
            });
        }
    });
}

function mdToHtml(md) {
    return new Promise(function(resolve, reject) {
        var cvt = new pagedown.Converter();
        var html = cvt.makeHtml(md);
        resolve(html);
    });
}

/*
function mdToHtml(md) {
    return new Promise(function (resolve, reject) {
        //var cvt = new pagedown.Converter();
        //var html = cvt.makeHtml(md);
        console.log(typeof stackedit);
        var se = new stackedit({ url: config.STACKEDIT_URL});
        se.openFile({
        name: "",
        content: {
            text: md
        }
    }, true); // true == silent mode
    se.on('fileChange', (file) => {
        console.log("md converted");
        resolve(html);
    });
    });

}
*/


function updateHistory(req, urlPath) {
    var historyHtml = "";

    var historyPath = urlPath;
    if (urlPath == "/") historyPath = "/home.md";

    if (req.session.history == undefined) req.session.history = [];

    if (historyPath.length < 3 || historyPath.slice(historyPath.length - 3) == ".md") {
        historyPath = historyPath.slice(0, historyPath.length - 3);
    }

    // Remove this url if we've already been there
    var index = req.session.history.indexOf(historyPath);
    if (index !== -1) req.session.history.splice(index, 1);

    // eliminate some random files that get requested
    if (historyPath.length < 4 || historyPath.slice(historyPath.length - 4) != ".map") {
        req.session.history.push(historyPath);
        // Trim to no more than the last 10 places
        if (req.session.history.length > 10) {
            req.session.history.splice(0, 10);
        }
    }


    historyHtml = req.session.history.reverse().map(s => LinkToLinkify(s, "his")).join("\n");
    return historyHtml;
}

function wikiPageReplyWithMdHtml(req, res, md, html, urlPath) {
    var historyHtml = updateHistory(req, urlPath);
    var meta = null;

    var headings = "";
    var error = "";
    appendHeading = function(tagName, text, attribs) {
        console.log("TAG: " + tagName + " " + text)
        headings += '<div class="ltoc_' + tagName + '"></span><span class="itoc_' + tagName + '" onclick="jumpTo(\'' + text + '\')">' + text + "</span></div>\n"
    };
    // console.log("HEADINGS: " + headings)
    html = sanitizer(html, {
        allowedTags: sanitizer.defaults.allowedTags.concat(['iframe', 'img', 'h1', 'h2']),
        exclusiveFilter: function(frame) {
            if (titles.includes(frame.tag)) appendHeading(frame.tag, frame.text, frame.attribs);
            if (frame.tag == "div" && frame.attribs["class"] == "cwikmeta") {
                try {
                    console.log("parsing: " + frame.text);
                    meta = JSON.parse(frame.text);
                } catch (err) {
                    error += err.message;
                }
                return true;
            }
            return false; // Don't remove anything based on this filter -- I am just trying to extract headings
        }
    });
    //console.log("META: " + JSON.stringify(meta))
    //console.log(html);
    title = ""
    related = ""
    if (meta) {
        console.log("meta " + JSON.stringify(meta));
        if (meta.title) title = meta.title;
        if (meta.related) {
            console.log("related ");
            related = meta.related.map(t => LinkToLinkify(t, "rel")).join("\n");
        }
    }

    user = {
        loggedIn: (req.session.uid != undefined) ? true : false
    };

    if (req.query.json)
        res.json({
            zzwikiPage: "loading...",
            structure: headings,
            title: title,
            related: related,
            thisPage: urlPath,
            rawMarkdown: md,
            history: historyHtml,
            user: user,
            notification: "",
            STACKEDITOR_URL: config.STACKEDIT_URL
        })
    else
        res.render('wikibrowse', {
            zzwikiPage: "loading...",
            structure: headings,
            title: title,
            related: related,
            thisPage: urlPath,
            rawMarkdown: md,
            history: historyHtml,
            user: user,
            notification: "",
            STACKEDITOR_URL: config.STACKEDIT_URL
        });
}
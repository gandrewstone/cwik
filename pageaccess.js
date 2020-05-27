var fs = require('fs');
var path = require('path');
var pagedown = require("pagedown");
var puppeteer = require('puppeteer');

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

function ensureUserRepoCreated(userSpace, contentHome) {
    // Make a working space for this user if one does not yet exist
        if (!fs.existsSync(userSpace)) {
            // Refresh my local copy
            git.pull(contentHome, UPSTREAM_REPO_NAME, REPO_BRANCH_NAME,
                function(err, oid) {
                    if (err != null) console.log("pull " + contentHome + " error " + err);

                    // then copy it to the user's space
                    ncp(contentHome, userSpace, function(err) {
                        if (err) {
                            console.error("ncp copy error: " + err);
                            return contentHome;
                        }
                        console.log("user scratch space created!");
                    });
                });
            return contentHome; // While I'm waiting for the copy, allow the user to read
        }
    return userSpace;
}


// Return a requested page
handleAPage = function(req, res) {
    let notification = undefined;
    let userSpace = "";
    let readFrom = contentHome;
    let user = {};
    let jReply = {user:user, notification:notification};

    if (req.session.uid == undefined) {
        req.session.uid = "bitcoincash:qr8ruwyx0u7fqeyu5n49t2paw0ghhp8xsgmffesqzs";
    }

    if (req.session.uid == undefined) {
        // require login to view:
        // return res.redirect(307,"/_login_")
        user['loggedIn'] = false;
        user['editProposal'] = undefined;

    } else {
        userSpace = config.USER_FORK_ROOT + "/" + req.session.uid.split(":")[1];
        console.log("User space: " + userSpace);

        readFrom = ensureUserRepoCreated(userSpace, contentHome);

        if (git.changedFiles[req.session.uid] == undefined) {
            git.loadChangedFiles(req.session.uid, req.session);
        }

        if (req.session.editProposal == undefined)
        {
            git.repoBranchNameByUid(req.session.uid).then(br => {
                if (br != config. REPO_BRANCH_NAME) req.session.editProposal = br;
                else req.session.editProposal = "";
                user['editProposal'] = req.session.editProposal;  // Probably won't be updated in time for this req...
                        });
        }
        else
        {
            console.log("session EP is: " + req.session.editProposal);
        }

        user['loggedIn'] = true;
        user['editProposal'] = req.session.editProposal;
    }

    console.log("handle a page: " + req.path);
    console.log("hostname: " + req.hostname);
    console.log("originalUrl: " + req.originalUrl);

    if (req.path == "/favicon.ico") {
        res.sendFile("public/images/icon.ico");
        return;
    }

    urlPath = req.path;
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

    if (!req.query.raw) {
    jReply['STACKEDITOR_URL'] = config.STACKEDIT_URL;
    jReply['history'] = updateHistory(req, urlPath);
    jReply['related'] = "";
    jReply['title'] = "";
    jReply['structure'] = "";
    jReply['wikiPage'] = "";
    jReply['thisPage'] = urlPath;
    jReply['rawMarkdown'] = "";
    }

    console.log("read file: " + filepath);
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) {
            console.log("no page");
            data = "";
            jReply['notification'] = "nonexistent page, click 'edit' to create";

            if (req.query.json) {
                console.log("trying " + readFrom + "/cwikTemplate.html");
                return fs.readFile(readFrom + "/cwikTemplate.html", 'utf8', function(err, htmlTemplateData) {
                    if (err) {
                        console.log("template missing");
                        return res.json(jReply);
                    }
                    jReply['html'] = htmlTemplateData;  // There's some override html
                    jReply['wikiPage'] = undefined;     // but no html corresponding to this page
                    return res.json(jReply);

                });
            } else
            {
                console.log("wiki browse no page");
                return fs.readFile(readFrom + "/cwikTemplate.html", 'utf8', function(err, htmlTemplateData) {
                    jReply['wikiPage'] = htmlTemplateData;  // place override html directly into the page
                    return res.render('wikibrowse', jReply);
                });
            }
        }

        if (req.query.raw) {
            res.send(data);
            return;
        }

        let doc = data;

        let htmlFile = filepath.slice(0, filepath.length - 2) + "html";
        // console.log("HTML file is: " + htmlFile);
        let regenerate = false;
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
            // console.log("regenerate " + htmlFile);
            mdToHtml(doc).then(html => {
                fs.writeFile(htmlFile, html, function(err) {
                    console.log("write error: " + err);
                })
                wikiPageReplyWithMdHtml(req, res, doc, html, jReply);
            });
        } else {
            fs.readFile(htmlFile, 'utf8', function(err, html) {
                if (err) {
                    mdToHtml(doc).then(html => {
                        wikiPageReplyWithMdHtml(req, res, doc, html, jReply);
                    });
                } else {
                    wikiPageReplyWithMdHtml(req, res, doc, html, jReply);
                }
            });
        }
    });
}

function mdToHtmlPagedown(md) {
    return new Promise(function(resolve, reject) {
        var cvt = new pagedown.Converter();
        var html = cvt.makeHtml(md);
        resolve(html);
    });
}



const PuppeteerDebug = false;

// Perfect conversion of md to html is a client-side process because some libraries are not available on the server side.
// For this reason we must create a client on the server side, and drive it to execute the conversion.
var browser = undefined;
puppeteer.launch({headless: !PuppeteerDebug, defaultViewport: { width:900, height:1024 }}).then(b => { browser = b; });

async function mdToHtml(md) {
    const page = await browser.newPage();
    await page.goto(config.MY_URL + "/_cvt_");
    
    await page.evaluate(function(md) {
        contentRenderCallback = function() { console.log("content rendered") };
        return processFetchedMd(md);
    }, md);
    //await page.waitFor(250);  // Do I need to wait for the katex, mermaid, etc to render or is that done synchronously?  If so, can wait for custom event: https://github.com/puppeteer/puppeteer/blob/master/examples/custom-event.js
    const contentHtml = await page.evaluate("document.querySelector('.wikicontent').innerHTML");
    if (!PuppeteerDebug) page.close();
    return(contentHtml);
}



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

function wikiPageReplyWithMdHtml(req, res, md, html, jReply) {
    var meta = null;
    var headings = "";
    var error = "";
    appendHeading = function(tagName, text, attribs) {
        console.log("TAG: " + tagName + " " + text)
        headings += '<div class="ltoc_' + tagName + '"></span><span class="itoc_' + tagName + '" onclick="jumpTo(\'' + text + '\')">' + text + "</span></div>\n"
    };
    // console.log("HEADINGS: " + headings)

    // I don't care about the xformedhtml. I just care about TOC generation
    xformedhtml = sanitizer(html, {
        allowedTags: sanitizer.defaults.allowedTags.concat(['iframe', 'img', 'h1', 'h2']),
        exclusiveFilter: function(frame) {
            if (titles.includes(frame.tag)) appendHeading(frame.tag, frame.text, frame.attribs);
            if (frame.tag == "div" && frame.attribs["class"] == "cwikmeta") {
                try {
                    // console.log("parsing: " + frame.text);
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
        // console.log("meta " + JSON.stringify(meta));
        if (meta.title) title = meta.title;
        if (meta.related) {
            // console.log("related ");
            related = meta.related.map(t => LinkToLinkify(t, "rel")).join("\n");
        }
    }

    jReply['title']=title;
    jReply['related']=related;
    jReply['structure']=headings;
    jReply['wikiPage'] = html;
    jReply['rawMarkdown'] = md;

    if (req.query.json)
        res.json(jReply);
    else
        res.render('wikibrowse', jReply);
}

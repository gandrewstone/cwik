var fs = require('fs');
var path = require('path');
var pagedown = require("pagedown");
var mdToHtml = require('./mdtohtml');

var path = require("path");
var git = require("./cwikgit");
var config = require("./config");
var misc = require("./misc");

var ncp = require('ncp').ncp;
ncp.limit = 16; // number of simultaneous copy operations allowed


function BadURL(req, res) {
    res.status(404).send('Sorry, we cannot find that!')
}

function ensureUserRepoCreated(repoCfg, userSpace, contentHome) {
    // Make a working space for this user if one does not yet exist
    if (!fs.existsSync(userSpace)) {
        // Refresh my local copy
        git.pull(contentHome, repoCfg.UPSTREAM_NAME, repoCfg.BRANCH_NAME,
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
    let user = {};
    let jReply = {
        user: user,
        notification: notification
    };

    //if (req.session.uid == undefined) {
    //    req.session.uid = "bitcoincash:qr8ruwyx0u7fqeyu5n49t2paw0ghhp8xsgmffesqzs";
    //}
    let repoCfg = config.REPOS[0]; // TODO determine the repo from the page URL
    let readFrom = "";

    if (req.session.uid == undefined) {
        // require login to view:
        // return res.redirect(307,"/_login_")
        user['loggedIn'] = false;
        user['editProposal'] = undefined;
        userSpace = repoCfg.DIR + "/" + config.ANON_REPO_SUBDIR;
        readFrom = path.resolve(userSpace);


    } else {
        userSpace = repoCfg.DIR + "/" + req.session.uid.split(":")[1];
        console.log("User space: " + userSpace);

        readFrom = ensureUserRepoCreated(repoCfg, userSpace, contentHome);

        if (git.changedFiles[req.session.uid] == undefined) {
            git.loadChangedFiles(repoCfg, req.session.uid, req.session);
        }

        if (req.session.editProposal == undefined) {
            git.repoBranchNameByUid(repoCfg, req.session.uid).then(br => {
                if (br != repoCfg.BRANCH_NAME) req.session.editProposal = br;
                else req.session.editProposal = "";
                user['editProposal'] = req.session.editProposal; // Probably won't be updated in time for this req...
            });
        } else {
            console.log("session EP is: " + req.session.editProposal);
        }

        user['loggedIn'] = true;
        user['editProposal'] = req.session.editProposal;
    }

    console.log("handle a page: " + req.path);
    console.log("hostname: " + req.hostname);
    console.log("originalUrl: " + req.originalUrl);
    console.log("readFrom: " + readFrom);

    if (req.path == "/favicon.ico") {
        res.sendFile("public/images/icon.ico");
        return;
    }

    urlPath = req.path;
    decodedPath = decodeURI(urlPath);
    decodedPath = decodedPath.replace(" ", "__"); // replace spaces with double underscore

    let isMedia = -1;
    for (let i = 0; i < config.MEDIA_EXT.length; i++) {
        if (decodedPath.endsWith(config.MEDIA_EXT[i])) {
            isMedia = i;
            break;
        }
    }

    if (isMedia == -1)
        decodedPath = decodedPath.toLowerCase(); // wiki pages are not case sensitive
    if (decodedPath.startsWith(".")) return BadURL(req, res); // Don't allow overwriting dot files
    if (decodedPath.includes("..")) return BadURL(req, res);
    if (decodedPath == "/") decodedPath = "/home"; // hard code / to home.md
    if (decodedPath.endsWith("/")) decodedPath = decodedPath.substring(0, decodedPath.length - 1);

    if (typeof config.MY_URL !== "undefined") {
        let canonicalURL = config.MY_URL + decodedPath;
        if (canonicalURL.endsWith(".md")) {
            canonicalURL = canonicalURL.slice(0, canonicalURL.length - 3);
        }
        jReply["canonicalURL"] = canonicalURL;
        console.log("CanonicalURL: " + canonicalURL);
    }

    var filepath = readFrom + decodedPath; //  + ".md";

    if (isMedia >= 0) {
        filepath = path.resolve(filepath);
        console.log("media file path: " + filepath);
        if (!user.loggedIn) return res.sendFile(filepath);
        try {
            let mediaFileStats = fs.statSync(filepath);
            if (req.query.upload) {
                jReply["isMediaImage"] = true;
                res.render('newMedia', jReply);
            } else res.sendFile(filepath);
        } catch (err) {
            res.status(404).render('newMedia', jReply);
        }

        return;
    }

    if (isMedia == -1 && !filepath.endsWith(".md")) {
        filepath = filepath + ".md";
    }
    console.log("access " + filepath);

    if (req.method == "POST") {
        let repoRelativeFilePath = decodedPath.slice(1);

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
            git.saveChangedFiles(repoCfg, req.session.uid, chFiles);
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
            data = "";
            jReply['notification'] = "nonexistent page, click 'edit' to create";

            if (req.query.json) {
                console.log("trying " + readFrom + "/cwikTemplate.html");
                return fs.readFile(readFrom + "/cwikTemplate.html", 'utf8', function(err, htmlTemplateData) {
                    if (err) {
                        console.log("template missing");
                        return res.json(jReply);
                    }
                    jReply['html'] = htmlTemplateData; // There's some override html
                    jReply['wikiPage'] = undefined; // but no html corresponding to this page
                    return res.json(jReply);

                });
            } else {
                if (user.loggedIn) {
                    jReply['SITE_NAME'] = config.SITE_NAME;
                    console.log("wiki browse no page");
                    return fs.readFile(readFrom + "/cwikTemplate.html", 'utf8', function(err, htmlTemplateData) {
                        jReply['wikiPage'] = htmlTemplateData; // place override html directly into the page
                        return res.render('wikibrowse', jReply);
                    });
                } else {
                    return fs.readFile("noPageNoUser.html", 'utf8', function(err, htmlTemplateData) {
                        jReply['wikiPage'] = htmlTemplateData; // place override html directly into the page
                        return res.render('wikibrowse', jReply);
                    });
                }
            }
        }

        if (req.query.raw) {
            res.send(data);
            return;
        }

        let doc = data;

        let htmlFile = filepath.slice(0, filepath.length - 2) + "htm";
        let metaFile = filepath.slice(0, filepath.length - 2) + "meta";
        let regenerate = false;
        try {
            let htmlFileStats = fs.statSync(htmlFile);
            let mdFileStats = fs.statSync(filepath);
            console.log("Times: html: " + htmlFileStats.mtime + " md: " + mdFileStats.mtime);
            if (htmlFileStats.mtime <= mdFileStats.mtime) regenerate = true;
        } catch (err) {
            // console.log(err);
            regenerate = true;
        }

        if (regenerate) {
            // Convert markdown to html
            console.log("regenerate " + htmlFile);
            mdToHtml.mdToHtml(doc).then(data => {
                console.log("regenerated");
                let html = data.html;
                delete data.html;
                misc.updateDict(jReply, data);
                jReply.wikiPage = html;
                wikiPageReplyWithMdHtml(req, res, doc, jReply);

                fs.writeFile(htmlFile, html, function(err) {
                    if (err != null) console.log("write error for: " + htmlFile + ": " + err);
                })
                fs.writeFile(metaFile, JSON.stringify(data), function(err) {
                    if (err != null) console.log("write error for: " + metaFile + ": " + err);
                })

            });
        } else {
            fs.readFile(metaFile, 'utf8', function(err, metaData) {
                if (err) metaData = {}; // Just ignore if metadata file does not exist
                fs.readFile(htmlFile, 'utf8', function(err, readData) {
                    if (err) {
                        mdToHtml.mdToHtml(doc).then(data => {
                            misc.updateDict(jReply, data);
                            wikiPageReplyWithMdHtml(req, res, doc, jReply);
                        });
                    } else {
                        let data = JSON.parse(metaData);
                        misc.updateDict(jReply, data);
                        jReply.wikiPage = readData;
                        wikiPageReplyWithMdHtml(req, res, doc, jReply);
                    }
                });
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


    historyHtml = req.session.history.reverse().map(s => misc.LinkToLinkify(s, "his")).join("\n");
    return historyHtml;
}

/* This function converts json data that would be passed directly to the client if ?json=1 into HTML appropriate for the
   pug scripts.  Changes here need equivalent changes in layout.js updatePage */
function htmlizeJsonReply(json) {
    if (typeof json.related !== "undefined") {
        let relatedStr = "";
        for (let i = 0; i < json.related.length; i++) {
            relatedStr = relatedStr.concat(misc.LinkToLinkify(json.related[i], "rel"));
        }
        json.related = relatedStr;
    }

}

function wikiPageReplyWithMdHtml(req, res, md, jReply) {
    jReply['rawMarkdown'] = md;
    jReply['ogType'] = 'website';
    if (typeof config.SITE_NAME !== "undefined")
        jReply['site'] = config.SITE_NAME;

    if (typeof jReply['pic'] == "undefined") {
        if (typeof config.DEFAULT_PIC !== "undefined") {
            jReply['pic'] = config.DEFAULT_PIC;
        }
    }

    // fixup the "pic" tag to be a full URL
    if (typeof jReply['pic'] !== "undefined") {
        let pic = jReply['pic'];
        if (!pic.startsWith("http")) {
            if (!pic.startsWith("/")) pic = "/" + pic;
            jReply['pic'] = (config.MY_URL + pic);
        }

    }

    if (req.query.json)
        res.json(jReply);
    else {
        htmlizeJsonReply(jReply);
        jReply['SITE_NAME'] = config.SITE_NAME;
        res.render('wikibrowse', jReply);
    }
}

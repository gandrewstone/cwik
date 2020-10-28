var fs = require('fs');
var fsp = fs.promises;
var path = require('path');
var pagedown = require("pagedown");
var mdToHtml = require('./mdtohtml');

var path = require("path");
var git = require("./cwikgit");
var config = require("./config");
var misc = require("./misc");
var users = require("./users");
var pug = require("pug");

function BadURL(req, res) {
    res.status(404).send('Sorry, we cannot find that!')
}


// Returns [repoCfg, fullpath, canonicalSuffix, media]
function determineRepoAndDir(uid, filepath) {
    let userDir = (uid == null) ? null : misc.userDir(uid);
    console.log("determine repo and dir: " + filepath)
    let media = isMedia(filepath);
    let suffixPath = cleanupPath(filepath, media);
    let firstPath = null;

    for (let j = 0; j < config.REPOS.length; j++) {
        let repoCfg = config.REPOS[j];
        let slashpfx = "/" + repoCfg.PREFIX;
        if (repoCfg.PREFIX == "") slashpfx = "";

        if (userDir) {
            try {
                let canonicalSuffix = "/" + userDir + suffixPath;
                console.log("Trying: " + repoCfg.DIR + canonicalSuffix);
                let fullpath = path.resolve(repoCfg.DIR + canonicalSuffix);
                if (firstPath == null) firstPath = fullpath;
                let mediaFileStats = fs.statSync(fullpath);
                return [repoCfg, fullpath, slashpfx + suffixPath, media];
            } catch (err) {
                console.log("NO");
                if (err.code != "ENOENT") console.log(err);
                // maybe repo not cloned to the user
            }

            if (suffixPath.startsWith("/" + repoCfg.PREFIX)) {
                let tmp = suffixPath.slice(repoCfg.PREFIX.length + 1);
                try {
                    console.log("trying: " + repoCfg.DIR + "/" + userDir + tmp);
                    let fullPath = path.resolve(repoCfg.DIR + "/" + userDir + tmp);
                    if (firstPath == null) firstPath = fullPath;
                    let mediaFileStats = fs.statSync(fullPath);
                    console.log("found!");
                    return [repoCfg, fullPath, slashpfx + tmp, media];
                } catch (err) {
                    console.log("NO");
                    if (err.code != "ENOENT") console.log(err);
                    // Ok not in this repo
                }
            }
        }

        // Check internal link in a repo.  TODO we might want to check the last session request to discover which repo its in.
        try {
            let canonicalSuffix = "/" + config.ANON_REPO_SUBDIR + suffixPath;
            console.log("Trying: " + repoCfg.DIR + canonicalSuffix);
            let fullpath = path.resolve(repoCfg.DIR + canonicalSuffix);
            if (firstPath == null) firstPath = fullpath;
            let mediaFileStats = fs.statSync(fullpath);
            console.log("found!");
            return [repoCfg, fullpath, slashpfx + suffixPath, media];
        } catch (err) {
            console.log("NO");
            if (err.code != "ENOENT") console.log(err);
            // Ok not in this repo
        }


        if (suffixPath.startsWith("/" + repoCfg.PREFIX)) {
            let tmp = suffixPath.slice(repoCfg.PREFIX.length + 1);
            try {
                console.log("trying: " + repoCfg.DIR + "/" + config.ANON_REPO_SUBDIR + tmp);
                let fullPath = path.resolve(repoCfg.DIR + "/" + config.ANON_REPO_SUBDIR + tmp);
                if (firstPath == null) firstPath = fullPath;
                let mediaFileStats = fs.statSync(fullPath);
                console.log("found!");
                return [repoCfg, fullPath, slashpfx + tmp, media];
            } catch (err) {
                console.log("NO");
                if (err.code != "ENOENT") console.log(err);
                // Ok not in this repo
            }
        }

    }

    // for now, a nonexistent file is assumed to be a new file in the first repo
    // TODO figure out placement by subdir
    let repoCfg = config.REPOS[0]
    let slashpfx = "/" + repoCfg.PREFIX;
    if (repoCfg.PREFIX == "") slashpfx = "";

    return [repoCfg, firstPath, slashpfx + suffixPath, media];
}

function isMedia(filepath) {
    for (let i = 0; i < config.MEDIA_EXT.length; i++) {
        if (filepath.endsWith(config.MEDIA_EXT[i])) {
            return config.MEDIA_EXT[i];
        }
    }
    return null;
}

function cleanupPath(filepath, isMedia) {
    let decodedPath = decodeURI(filepath);
    // console.log(decodedPath);
    decodedPath = decodedPath.replace(" ", "__"); // replace spaces with double underscore

    // TODO
    if (decodedPath.startsWith(".")) throw BadURL(req, res); // Don't allow overwriting dot files
    if (decodedPath.includes("..")) throw BadURL(req, res);

    if (isMedia == null) {
        decodedPath = decodedPath.toLowerCase(); // wiki pages are not case sensitive
        if (decodedPath == "/") decodedPath = "/home"; // hard code / to home.md
    }

    if (decodedPath.endsWith("/")) decodedPath = decodedPath.substring(0, decodedPath.length - 1);

    if (isMedia == null && !decodedPath.endsWith(".md")) {
        decodedPath = decodedPath + ".md";
    }

    console.log("cleanup path: " + decodedPath);
    return decodedPath;
}


async function handlePdfPageAsync(req, res) {
    // Chop off the prefix
    let webpath = req.path.slice("/_pdf_".length);

    [repoCfg, readFrom, canonicalSuffix, media] = determineRepoAndDir(req.session.uid, webpath);

    if (media != null)  // Can't ask for pdf conversion of some media
    {
        res.status(401).send("");
        return;
    }
    let filepath = readFrom;
    if (!filepath.endsWith(".md")) {
        filepath = filepath + ".md";
    }
    let pdfFile = filepath.slice(0, filepath.length - 2) + "pdf";

    await mdToHtml.pageToPdf(webpath, pdfFile);
    let pdfData = await fsp.readFile(pdfFile, null);
    res.writeHead(200, {'Content-Type': 'application/pdf'});
    res.end(pdfData, 'binary');
}

handlePdfPage = function(req, res) {
    handlePdfPageAsync(req,res);
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

    let media = null;

    [repoCfg, readFrom, canonicalSuffix, media] = determineRepoAndDir(req.session.uid, req.path);
    console.log("repoCfg: " + JSON.stringify(repoCfg) + " readFrom: " + readFrom + " media: " + media + " suffix: " + canonicalSuffix);

    let userPerms = {};

    if (req.session.uid == undefined) {
        // require login to view:
        // return res.redirect(307,"/_login_")
        user['loggedIn'] = false;
        user['editProposal'] = undefined;
    } else {
        // shouldn't be needed
        // readFrom = git.ensureUserRepoCreated(repoCfg, userSpace, contentHome);

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
        userPerms = users.known(req.session.uid);
        user['perms'] = userPerms;
    }

    console.log("handle a page: " + req.path);
    console.log("hostname: " + req.hostname);
    console.log("originalUrl: " + req.originalUrl);
    console.log("readFrom: " + readFrom);
    console.log("media: " + media);

    if (req.path == "/favicon.ico") {
        res.sendFile("public/images/icon.ico");
        return;
    }

    urlPath = req.path;
    let filepath = readFrom;

    if (typeof config.MY_URL !== "undefined") {
        let canonicalURL = config.MY_URL + canonicalSuffix;
        if (canonicalURL.endsWith(".md")) {
            canonicalURL = canonicalURL.slice(0, canonicalURL.length - 3);
        }
        jReply["canonicalURL"] = canonicalURL;
        console.log("CanonicalURL: " + canonicalURL);
    }

    if (media != null) {
        filepath = path.resolve(filepath);
        console.log("media file path: " + filepath);
        if (!user.loggedIn) {
            try {
                let mediaFileStats = fs.statSync(filepath);
                if (media == ".apk") res.contentType = 'application/vnd.android.package-archive';
                if (media == ".dmg") res.contentType = 'application/octet-stream';
                return res.sendFile(filepath);
            } catch (err) {
                console.log(err);
                return fs.readFile("noPageNoUser.html", 'utf8', function(err, htmlTemplateData) {
                    jReply['wikiPage'] = htmlTemplateData; // place override html directly into the page
                    return res.status(404).render('wikibrowse', jReply);
                });
            }
        }
        try {
            let mediaFileStats = fs.statSync(filepath);
            if (req.query.upload) {
                jReply["isMediaImage"] = true;
                res.render('newMedia', jReply);
            } else {
                if (media == ".apk") res.contentType = 'application/vnd.android.package-archive';
                if (media == ".dmg") res.contentType = 'application/octet-stream';
                res.sendFile(filepath, null, function(err) {
                    if (err) console.log("send error: " + err);
                });
            }
        } catch (err) {
            res.status(404).render('newMedia', jReply);
        }

        return;
    }

    if (media == null && !filepath.endsWith(".md")) {
        filepath = filepath + ".md";
    }

    if (req.method == "POST") {
        if (req.session.uid == undefined) {
            res.json({
                notification: "unauthorized edit attempt, log in first!"
            });
            return;
        }

        let writeFilePath = readFrom;
        let userDir = misc.userDir(req.session.uid);

        let repoPrefix = path.resolve(repoCfg.DIR + "/" + userDir);
        if (!writeFilePath.startsWith(repoPrefix)) {
            console.log("Attempt to edit " + writeFilePath + ", expecting " + repoPrefix);
            return res.json({
                notification: "unauthorized edit location!"
            });
        }

        let repoRelativeFilePath = writeFilePath.slice(repoPrefix.length + 1); // +1 chops off the /


        var chFiles = git.changedFiles[req.session.uid];

        if (!chFiles.has(repoRelativeFilePath)) {
            chFiles.add(repoRelativeFilePath);
            git.saveChangedFiles(repoCfg, req.session.uid, chFiles);
        }

        var dirOfPost = path.dirname(writeFilePath);
        if (!fs.existsSync(dirOfPost))
            fs.mkdirSync(dirOfPost, {
                recursive: true
            });

        fs.writeFile(writeFilePath, req.body, (err) => {
            if (err) {
                console.log("POST content file write error: " + err.message);
                res.json({
                    notification: err.message
                });
            } else {
                console.log("file write success: " + filepath);
                res.send("ok");
            }
        });
        return;
    }

    console.log("reading " + filepath);

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
            console.log(err);
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
            // console.log(raw);
            res.send(data);
            return;
        }

        console.log("file pulled");
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
            console.log("html vs md fstat: " + err);
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
            console.log("read metafile");
            fs.readFile(metaFile, 'utf8', function(err, metaData) {
                if (err) metaData = {}; // Just ignore if metadata file does not exist
                fs.readFile(htmlFile, 'utf8', function(err, readData) {
                    if (err) {
                        console.log("read metafile error:" + err);
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

    // console.log("history: path " + urlPath + " -> " + historyPath);

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
    // console.log("wikiPageReplyWithMdHtml");
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

    if (req.query.json) {
        console.log("json reply");
        res.json(jReply);
    } else if (req.query.contentonly) {
        console.log("content only html");
        res.render('wikicontent', jReply);
    } else
    {
        console.log("html reply");
        htmlizeJsonReply(jReply);
        jReply['SITE_NAME'] = config.SITE_NAME;
        res.render('wikibrowse', jReply);
    }
}

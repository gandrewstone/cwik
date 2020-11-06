var auth = require("../auth.js");
var git = require("../cwikgit.js");
var config = require("../config.js");
var misc = require("../misc.js");
var express = require('express');
var router = express.Router();
var multer = require('multer')
var path = require('path');
var search = require("../search");
var users = require("../users");
var fs = require('fs');

var myProtocol = config.MY_URL.split(":")[0];
var myHost = config.MY_URL.split("//")[1];  // Don't use req.headers.host in case site is deployed with a load balancer or forwarder (nginx or apache2)

// https://stackoverflow.com/questions/4856717/javascript-equivalent-of-pythons-zip-function
function zip(arrays) {
    return arrays[0].map(function(_, i) {
        return arrays.map(function(array) {
            return array[i]
        })
    });
}

/* GET home page. */
router.get('/', function(req, res, next) {
    return handleAPage(req, res);
});


router.get('/_logout_', function(req, res, next) {
    req.session.challenge = undefined;
    req.session.uid = undefined;
    req.session.editProposal = "";
    res.redirect("/");
});

router.get('/_commit_', function(req, res, next) {
    if (req.session.uid == undefined) {
        res.json({
            notification: "unauthorized commit: log in first!"
        });
        return;
    }
    let user = users.known(req.session.uid);
    if (user == null) {
        res.json({
            notification: "unauthorized commit: unregistered user"
        });
        return;
    }


    if (req.session.editProposal) {
        if (!user.propose) return res.json({
            notification: "unauthorized commit: contact site administrator"
        });
    } else {
        // If I don't have push access make sure I have access
        if (!user.push) {
            res.json({
                notification: "unauthorized commit: open an edit proposal first"
            });
        }
    }
    console.log("commit to repo");
    config.REPOS.forEach(repo => {
        git.commitEdits(req, res, repo, null, user); // sets res to a json response detailing whether the commit was successful
    });
});


// Any HTTP ok, but actually an error returns a status code of > 250
// because 400+ status codes are handled by some clients as file not found
function processLogin(op, host, addr, cookie, sig, req, allowUnknownUser) {
    console.log("processLogin");
    console.log(host + " " + addr + " " + cookie + " " + sig);
    if (!addr.includes(":")) addr = "bitcoincash:" + addr;

    return new Promise(function(ok, err) {

        sessionStore.get(cookie, function(err, session) {
            if (err != null)
                console.log("session store: " + err.message);
            else
                console.log("got session for cookie");
            if (session != null) {
                let userInfo = users.known(addr);
                if (!userInfo) {
                    console.log("unknown user " + addr);
                    if (!allowUnknownUser) return ok([251, "unknown identity: " + addr]);
                }
                
                if (verifySig(host + "_bchidentity_" + op + "_" + session.challenge, addr, sig)) {

                    sessionStore.get(cookie, function(err, session2) {
                        console.log("reloaded session: " + JSON.stringify(session2));
                    });

                    // If connect with same session I need to write req because changing the sessionStore directly will be overwritten
                    // when this function returns.
                    if (cookie == req.sessionID) {
                        req.session.challenge = "solved";
                        req.session.uid = addr;
                        git.ensureUserReposCreated(addr);
                        git.repoBranchNameByUid(config.REPOS[0], req.session.uid).then(br => {
                            if (br != config.REPOS[0].BRANCH_NAME) req.session.editProposal = br;
                        });
                    } else // If I connected with a different (out-of-band) session, then I need to write the sessionStore directly
                    {
                        session.challenge = "solved";
                        session.uid = addr;
                        git.ensureUserReposCreated(addr);
                        git.repoBranchNameByUid(config.REPOS[0], addr).then(br => {
                            console.log("setting EP to: " + br)
                            if (br != config.REPOS[0].BRANCH_NAME) session.editProposal = br;
                            console.log("setting cookie to: " + JSON.stringify(session));
                            sessionStore.set(cookie, session, function(err) {
                                console.log("error?:" + JSON.stringify(err));
                            });
                        }, err => { // Even if we can't get the repo branch, still set the session
                            console.log("get branch error: " + err)
                            sessionStore.set(cookie, session, function(err) {
                                console.log("error?:" + JSON.stringify(err));
                            });
                        });

                    }
                    git.refreshRepoUser(addr);
                    console.log("login accepted");
                    if (userInfo) {
                        ok([200, "accepted"]);
                    } else {
                        ok([201, "accepted new user"]);
                    }
                    return;
                } else {
                    console.log("bad signature for challenge " + host + "_login_" + session.challenge);
                    ok([252, "bad signature"]);
                    return;
                }
            } else {
                console.log("unknown session");
                ok([253, "reload login page"]);
            }
        });
    });
}


router.post('/_reg_/auto', function(req, res, next) {
    console.log("POST registration call")
    console.log(JSON.stringify(req.body))

    if (req.body.op == "reg") {
        console.log("registration login");
        processLogin("reg", myHost, req.body.addr, req.body.cookie, req.body.sig, req, true).then(
            (result) => {
                let changed = false;
                const [code, response] = result;
                console.log("sending: " + response);
                if (code == 201) { // accepted unknown user, so add to database
                    users.create(req.body.addr, req.body.hdl, req.body.email);
                    changed = true;
                }
                if (code == 200) { // accepted known user, see if user updated any data
                    user = users.known(req.body.addr);
                    if (req.body.hdl && (req.body.hdl != user.hdl)) {
                        changed = true;
                        user.hdl = req.body.hdl;
                    }
                    if (req.body.email && (req.body.email != user.email)) {
                        changed = true;
                        user.email = req.body.email;
                    }
                }
                res.status(code).send(response);
                if (changed) users.save();
            });
    } else {
        res.status(404).send("unknown operation");
    }
    console.log("reg fun finished");
});

router.get('/_login_/auto', function(req, res, next) {
    console.log("connecting with session: " + req.sessionID);
    console.log("op=" + req.query.op);
    console.log("addr=" + req.query.addr);
    console.log("sig size: " + req.query.sig.length + " sig=" + req.query.sig);
    console.log("cookie=" + req.query.cookie);
    if (req.query.op == "login") {
        processLogin("login", myHost, req.query.addr, req.query.cookie, req.query.sig, req, false).then(
            (result) => {
                const [code, response] = result;
                console.log("sending: " + response);
                res.status(code).send(response);
            });
    } else {
        res.status(404).send("unknown operation");
    }
});

router.get('/_login_/check', function(req, res, next) {
    console.log("checking login status for: " + req.sessionID);
    console.log("session is: " + JSON.stringify(req.session));

    if (req.session.uid != undefined) {
        //res.status(201).send("logged in");
        res.redirect("/");
        return;
    }
    res.status(401).send("login required");
});

router.get('/_login_', function(req, res, next) {
    if (req.session.challenge == undefined) {
        req.session.challenge = getChallengeString();
    }
    
    console.log("session challenge: " + req.session.challenge);
    let QRcodeText = "bchidentity://" + myHost + '/_login_/auto?op=login&proto=' + myProtocol + '&chal=' + req.session.challenge + "&cookie=" + req.sessionID;
    let user = {
        loggedIn: (req.session.uid != undefined) ? true : false
    };
    let historyHtml = "";
    if (typeof req.session.history !== "undefined") {
        historyHtml = req.session.history.reverse().map(s => misc.LinkToLinkify(s, "his")).join("\n");
    }

    let QRregisterText = null;
    if (config.allowRegistration.includes("bchidentity")) {
        QRregisterText = "bchidentity://" + myHost + '/_reg_/auto?op=reg&proto=' + myProtocol + '&chal=' + req.session.challenge + "&cookie=" + req.sessionID + "&hdl=r&email=o";
    }

    res.render('login', {
        challenge: myHost + "_login_" + req.session.challenge,
        history: historyHtml,
        allowRegistration: config.allowRegistration,
        QRsignCode: QRcodeText,
        QRregCode: QRregisterText,
        user: user
    });
});

router.post('/_login_', function(req, res, next) {
    console.log("_login_: POST of " + JSON.stringify(req.body));
    sess = req.session;
    let error = "";
    let addr = req.body.addr;
    if (!addr.includes(":")) addr = "bitcoincash:" + addr;
    if (myHost + "_login_" + req.session.challenge != req.body.challenge) {
        error = "stale challenge string, try again";
        req.session.challenge = getChallengeString();
    } else if (KnownUser(addr) == false) {
        error = "unknown address";
    } else if (verifySig(req.body.challenge, addr, req.body.sig)) {
        sess.uid = addr;
        return res.redirect("/");
    } else {
        error = "incorrect signature";
    }

    let user = {
        loggedIn: (req.session.uid != undefined) ? true : false
    };
    let historyHtml = "";
    if (typeof req.session.history !== "undefined") {
        historyHtml = req.session.history.reverse().map(s => misc.LinkToLinkify(s, "his")).join("\n");
    }
    let QRcodeText = "bchidentity://" + myHost + '/_login_/auto?op=login&proto=' + myProtocol + '&chal=' + req.session.challenge + "&cookie=" + req.sessionID;
    console.log("error: " + error);
    res.render('login', {
        notification: error,
        challenge: myHost + "_login_" + req.session.challenge,
        history: historyHtml,
        QRsignCode: QRcodeText,
        user: user
    });
});


router.get('/_editProposal_/close', function(req, res, next) {
    console.log("closeEditProposal: " + req.path);
    if (req.session.uid == undefined) {
        console.log("not logged in");
        return res.json({
            notification: "unauthorized edit attempt, log in first!",
            error: 1
        });
    }

    let repoCfg = config.REPOS[0];

    git.repoBranchNameByUid(repoCfg, req.session.uid).then(curBranch => {
        if (curBranch == repoCfg.BRANCH_NAME) {
            req.session.editProposal = "";
            return res.json({
                notification: "no edit proposal is open",
                error: 1
            });
        }

        git.repoByUid(repoCfg, req.session.uid)
            .then(repo => git.branch(repo, repoCfg.BRANCH_NAME, repoCfg.UPSTREAM_NAME, true))
            .then(result => {
                req.session.editProposal = "";
                return res.json({
                    notification: "closed edit proposal '" + curBranch + "'",
                    error: 0
                });
            })
            .catch(err => {
                console.log("err " + err);
                return res.json({
                    notification: "Internal Error: " + err.message,
                    error: 1
                });
            });
    });
});


router.get('/_editProposal_/submit', function(req, res, next) {
    console.log("submitEditProposal: " + req.path);
    if (req.session.uid == undefined) {
        console.log("not logged in");
        return res.json({
            notification: "unauthorized edit attempt, log in first!",
            error: 1
        });
    }

    let repoCfg = config.REPOS[0];

    git.repoBranchNameByUid(repoCfg, req.session.uid).then(curBranch => {
        if (curBranch == repoCfg.BRANCH_NAME) {
            return res.json({
                notification: "no edit proposal is open",
                error: 1
            });
        }

        fs.appendFile(repoCfg.DIR + "/submittedEditProposals.txt", curBranch + "\n", err => {
            console.log("error appending to submitted EP: " + curBranch)
        });
        git.repoByUid(repoCfg, req.session.uid).then(repo => {
            console.log("repo is " + JSON.stringify(repo));

            // Push this branch to origin
            git.push(repo, repoCfg.UPSTREAM_NAME).then(ok => {
                // now switch back to master
                git.branch(repo, repoCfg.BRANCH_NAME, repoCfg.UPSTREAM_NAME, true).then(result => {
                    console.log("branch " + result);
                    req.session.editProposal = "";
                    return res.json({
                        notification: "submitted edit proposal '" + curBranch + "'",
                        error: 0
                    });
                }, err => {
                    console.log("err " + err);
                    return res.json({
                        notification: err,
                        error: 1
                    });
                });
            });
        }, err => {
            return res.json({
                notification: err,
                error: 1
            });
            console.log(err);
        });

    });
});

function printDiff(diff) {
    console.log("diff has " + diff.numDeltas() + " patches");
    for (let i = 0; i < diff.numDeltas(); i++) {
        let delta = diff.getDelta(i);
        console.log(i + ": " + delta + " " + delta.oldFile().path() + "->" + delta.newFile().path());
    }
}

function printPatches(patches) {
    console.log("printPatches");
    for (let i = 0; i < patches.length; i++) {
        console.log("patch file: " + patches[i].oldFile().path() + "=>" + patches[i].newFile().path());
        console.log("patch stats: " + JSON.stringify(patches[i].lineStats()));
        patches[i].hunks().then(hunks => {
            console.log("hunks");
            for (let j = 0; j < hunks.length; j++) {
                console.log(j + " " + JSON.stringify(hunks[j]));
                console.log(hunks[j].lines());
                hunks[j].lines().then(lines => {
                    console.log("async: " + JSON.stringify(lines));
                    for (let k = 0; k < lines.length; k++) {
                        console.log("line " + k + " origin: " + lines[k].origin());
                        console.log("line " + k + " oldLineno: " + lines[k].oldLineno());
                        console.log("line " + k + " newLineno: " + lines[k].newLineno());
                        console.log("line " + k + " numLines: " + lines[k].numLines());
                        console.log("line " + k + " content: " + lines[k].content());
                        console.log("line " + k + " rawcontent: " + lines[k].rawContent());
                        console.log("line " + k + " contentOffset: " + lines[k].contentOffset());
                        console.log("line " + k + " contentLen: " + lines[k].contentLen());
                    }
                });
            }
        });
    }
}



function resolveLines(hunk) {
    return new Promise(function(ok, rej) {
        hunk.lines().then(lines => {
            // console.log("resolveLinesPms" + lines.length);
            ret = [];
            for (let k = 0; k < lines.length; k++) {
                // console.log(" line " + k + " content: " + lines[k].content());
                ret.push({
                    content: lines[k].content(),
                    oldLinenum: lines[k].oldLineno(),
                    newLinenum: lines[k].newLineno(),
                    numLines: lines[k].numLines(),
                    // raw: lines[k].rawContent(),
                    offset: lines[k].contentOffset(),
                    len: lines[k].contentLen()
                });
            }
            ok(ret);
        });
    });
}

function resolveHunks(patch) {
    return new Promise(function(ok, rej) {
        patch.hunks().then(hunks => {
            // console.log("resolveHunksPms");
            let pms = [];
            for (let i = 0; i < hunks.length; i++) {
                pms.push(resolveLines(hunks[i]));
            }
            return Promise.all(pms).then(ok, rej);
        });
    });
}

function patchOp(p) {
    ret = []
    if (p.isAdded()) ret.push("added");
    if (p.isConflicted()) ret.push("conflicted");
    if (p.isCopied()) ret.push("copied");
    if (p.isDeleted()) ret.push("deleted");
    if (p.isIgnored()) ret.push("ignored");
    if (p.isModified()) ret.push("modified");
    if (p.isRenamed()) ret.push("renamed");
    if (p.isTypeChange()) ret.push("typechange");
    if (p.isUnmodified()) ret.push("unmodified");
    if (p.isUnreadable()) ret.push("unreadable");
    if (p.isUntracked()) ret.push("untracked");
    return ret;
}


function resolvePatches(patches) {
    return new Promise(function(ok, rej) {
        let pms = [];
        // console.log("resolvePatchesPms");
        let ret = [];
        for (let i = 0; i < patches.length; i++) {
            pms.push(resolveHunks(patches[i]));
            ret.push({
                oldfile: patches[i].oldFile().path(),
                newfile: patches[i].newFile().path(),
                op: patchOp(patches[i])
            });
        }
        return Promise.all(pms).then(result => {
            for (let i = 0; i < result.length; i++) {
                ret[i].hunks = result;
            }
            ok(ret);
        }, rej);
    });
}

function objectifyPatches(patches) {
    console.log("objectifyPatchesDecomposition");
    return new Promise(function(ok, rej) {
        resolvePatches(patches).then(ok, rej);
    });
}



router.get('/_editProposal_/diff', function(req, res, next) {
    console.log("diffEditProposal: " + req.path);
    if (req.session.uid == undefined) {
        console.log("not logged in");
        return res.json({
            notification: "unauthorized edit attempt, log in first!",
            error: 1
        });
    }

    let repoCfg = config.REPOS[0];

    git.repoBranchNameByUid(repoCfg, req.session.uid).then(curBranch => {
        if (curBranch == repoCfg.BRANCH_NAME) {
            return res.json({
                notification: "no edit proposal is open",
                error: 1
            });
        }

        git.repoByUid(req.session.uid).then(repo => {
            console.log("repo at " + repo.path());
            git.diffBranch(repo, repoCfg.BRANCH_NAME).then(diff => {
                printDiff(diff);
                //diff.patches().then(printPatches);
                diff.patches().then(p => objectifyPatches(p).then(patchLst => {
                    console.log("Patch data: " + JSON.stringify(patchLst, null, 4));
                }, err => {
                    console.log("error: " + err);
                }), err => {
                    console.log("error: " + err);
                });
                return res.json({
                    notification: "diff",
                    error: 0
                });
            }, err => {
                console.log("error: " + err);
            });
        }, err => {
            return res.json({
                notification: err,
                error: 1
            });
            console.log(err);
        });

    });
});


router.get('/_editProposal_/open/*', function(req, res, next) {
    console.log("openEditProposal: " + req.path);
    if (req.session.uid == undefined) {
        console.log("not logged in");
        return res.json({
            notification: "unauthorized edit attempt, log in first!"
        });
    }

    let user = users.known(req.session.uid);
    if (user == null) {
        return res.json({
            notification: "unauthorized operation: unregistered user"
        });
    }
    if (user.propose != true) {
        return res.json({
            notification: "unauthorized operation: contact site administrator"
        });
    }

    let ep = req.path.replace("/_editProposal_/open/", "");
    ep = ep.split(' ').join('_')
    console.log("EP Name is: " + ep);
    if (ep == "") {
        return res.json({
            notification: "empty edit proposal name"
        });
    }

    let repos = config.REPOS;
    if (repos == undefined) return res.json({
        notification: "repo config error (undefined), contact administrator",
        error: 1
    });
    if (repos.length == 0) return res.json({
        notification: "repo config error (length), contact administrator",
        error: 1
    });
    let repocfg = repos[0];

    git.repoBranchNameByUid(repocfg, req.session.uid).then(curBranch => {
        if (curBranch != repocfg.BRANCH_NAME) {
            return res.json({
                notification: "close or submit your current proposal",
                error: 1
            });
        }

        git.repoByUid(repocfg, req.session.uid).then(repo => {
            // console.log("repo is " + JSON.stringify(repo));
            git.branch(repo, ep, repocfg.UPSTREAM_NAME, true).then(result => {
                console.log("branch " + result);
                req.session.editProposal = ep;
                return res.json({
                    notification: "opened edit proposal '" + ep + "'",
                    error: 0
                });
            }, err => {
                console.log("err " + err);
                return res.json({
                    notification: err.message,
                    error: 1
                });
            });
        }, err => {
            return res.json({
                notification: err.message,
                error: 1
            });
            console.log(err);
        });
    });
});


router.post('/_search_', function(req, res, next) {
    console.log("POST _search_ of: " + req.body);
    let user = {};
    let jReply = {
        user: user
    };
    if (req.session.uid == undefined) {
        user['loggedIn'] = false;
        user['editProposal'] = undefined;
    } else {
        user['loggedIn'] = true;
        user['editProposal'] = req.session.editProposal;
    }
    jReply['STACKEDIT_URL'] = config.STACKEDIT_URL;
    jReply['STACKEDITOR_URL'] = config.STACKEDIT_URL;

    let result = search.search(req.body);
    jReply['searchResults'] = result;
    res.json(jReply);
});


/*
router.get('/_search_/*', function(req, res, next) {
    let result = search.search("test");
    res.send(JSON.stringify(result));
});
*/

router.get('/_cvt_', function(req, res, next) {
    let jReply = {};

    jReply['STACKEDIT_URL'] = config.STACKEDIT_URL;
    jReply['STACKEDITOR_URL'] = config.STACKEDIT_URL;
    jReply['wikiPage'] = "";
    jReply['rawMarkdown'] = "";
    res.render('cvt', jReply);
});

router.get('/_pdf_/*', function(req, res, next) {
    console.log("PDF conversion: " + req.path);
    handlePdfPage(req, res);
});

router.post('/_upload_/*', function(req, res, next) {
    if (req.session.uid == undefined) {
        return res.status(401).json({
            notification: "unauthorized upload attempt, log in first!"
        });
    }

    let repoCfg = config.REPOS[0];

    let urlPath = req.path;
    let decodedPath = decodeURI(urlPath);
    decodedPath = decodedPath.replace(" ", "__");
    decodedPath = decodedPath.slice("/_upload_".length);
    let userSpace = repoCfg.DIR + "/" + req.session.uid.split(":")[1];
    var writeFilePath = userSpace + decodedPath;

    console.log("POST an upload to: " + userSpace + " file: " + decodedPath);

    let storage = multer.diskStorage({
        destination: path.dirname(writeFilePath),
        filename: function(req, file, cb) {
            cb(null, path.basename(writeFilePath));
        }
        // '.' + mime.extension(file.mimetype));
    });

    let upload = multer({
        storage: storage,
        limits: { fileSize: 500000000 }
    });
    upload.single('file')(req, res, () => {}); // 3rd param is continuation if we need to process after file exists

    let chFiles = git.changedFiles[req.session.uid];
    let repoRelativeFilePath = decodedPath.slice(1);
    if (!chFiles.has(repoRelativeFilePath)) {
        chFiles.add(repoRelativeFilePath);
        git.saveChangedFiles(repoCfg, req.session.uid, chFiles);
    }

    return res.json({
        notification: "upload succeeded"
    });

});

router.use(handleAPage);




module.exports = router;

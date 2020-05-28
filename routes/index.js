var auth = require("../auth.js");
var git = require("../cwikgit.js");
var config = require("../config.js");
var express = require('express');
var router = express.Router();
var users = require('../knownusers.json')["KnownUsers"]



// https://stackoverflow.com/questions/4856717/javascript-equivalent-of-pythons-zip-function
function zip(arrays) {
    return arrays[0].map(function(_, i) {
        return arrays.map(function(array) {
            return array[i]
        })
    });
}

KnownUser = function(identity) {
    for (i = 0; i < users.length; i++) {
        if (users[i] == identity) {
            return true;
        }
    }
    return false;
}

/* GET home page. */
router.get('/', function(req, res, next) {
    return handleAPage(req, res);
});

router.get('/_logout_', function(req, res, next) {
    req.session.challenge = undefined;
    req.session.uid = undefined;
    res.redirect("/");
});

router.get('/_commit_', function(req, res, next) {
    if (req.session.uid == undefined) {
        res.json({
            notification: "unauthorized commit: log in first!"
        });
        return;
    }
    console.log("commit to repo");
    git.commitEdits(req, res, config.UPSTREAM_REPO_NAME); // sets res to a json response detailing whether the commit was successful
});

router.get('/_login_/auto', function(req, res, next) {
    console.log("connecting with session: " + req.sessionID);
    console.log("op=" + req.query.op);
    console.log("addr=" + req.query.addr);
    console.log("sig size: " + req.query.sig.length + " sig=" + req.query.sig);
    console.log("cookie=" + req.query.cookie);
    if (req.query.op == "login") {
        console.log("login");
        sessionStore.get(req.query.cookie, function(err, session) {
            if (err != null)
                console.log("session store: " + err.message);
            else
                console.log("got session for cookie");
            if (session != null) {
                if (!KnownUser(req.query.addr)) {
                    console.log("unknown user " + req.query.addr);
                    res.status(200).send("unknown identity");
                    return;

                }
                if (verifySig(req.headers.host + "_bchidentity_login_" + session.challenge, req.query.addr, req.query.sig)) {
                    sessionStore.get(req.query.cookie, function(err, session2) {
                        console.log("reloaded session: " + JSON.stringify(session2));
                    });

                    // If connect with same session I need to write req because changing the sessionStore directly will be overwritten
                    // when this function returns.
                    if (req.query.cookie == req.sessionID) {
                        req.session.challenge = "solved";
                        req.session.uid = req.query.addr;
                        git.repoBranchNameByUid(req.session.uid).then(br => {
                            if (br != config.REPO_BRANCH_NAME) req.session.editProposal = br;
                        });
                    } else // If I connected with a different (out-of-band) session, then I need to write the sessionStore directly
                    {
                        session.challenge = "solved";
                        session.uid = req.query.addr;
                        git.repoBranchNameByUid(req.session.uid).then(br => {
                            if (br != config.REPO_BRANCH_NAME) req.session.editProposal = br;
                            sessionStore.set(req.query.cookie, session);
                        }, err => { // Even if we can't get the repo branch, still set the session
                            sessionStore.set(req.query.cookie, session, function(err) {
                                console.log("error?:" + JSON.stringify(err));
                            });
                        });

                    }
                    git.refreshRepo(req.query.addr, config.UPSTREAM_REPO_NAME);
                    console.log("login accepted");
                    res.status(200).send("login accepted");
                    return;
                } else {
                    console.log("bad signature for challenge " + req.headers.host + "_login_" + session.challenge);
                    res.status(200).send("bad signature");
                    return;
                }
            } else {
                console.log("unknown session");
                res.status(404).send("unknown session");
            }
        });
    } else {
        res.status(404).send("unknown operation");
    }
});

router.get('/_login_/check', function(req, res, next) {
    console.log("checking login status for:" + req.sessionID);
    console.log(JSON.stringify(req.session));

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
    var QRcodeText = "bchidentity://" + req.headers.host + '/_login_/auto?op=login&chal=' + req.session.challenge + "&cookie=" + req.sessionID;
    user = {
        loggedIn: (req.session.uid != undefined) ? true : false
    };
    res.render('login', {
        challenge: req.headers.host + "_login_" + req.session.challenge,
        QRsignCode: QRcodeText,
        user: user
    });
});

router.post('/_login_', function(req, res, next) {
    console.log("_login_: POST of " + JSON.stringify(req.body));
    sess = req.session;
    if (req.headers.host + "_login_" + req.session.challenge != req.body.challenge) {
        res.send("stale challenge string");
    } else if (KnownUser(req.body.addr) == false) {
        res.send("unknown user");
    } else if (verifySig(req.body.challenge, req.body.addr, req.body.sig)) {
        sess.uid = req.body.addr;
        res.redirect("/");
    } else {
        res.send("bad sig");
    }
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

    repoBranchNameByUid(req.session.uid).then(curBranch => {
        if (curBranch == config.REPO_BRANCH_NAME) {
            return res.json({
                notification: "no edit proposal is open",
                error: 1
            });
        }

        git.repoByUid(req.session.uid)
            .then(repo => git.branch(repo, config.REPO_BRANCH_NAME, config.UPSTREAM_REPO_NAME, true))
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
                    notification: err,
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

    repoBranchNameByUid(req.session.uid).then(curBranch => {
        if (curBranch == config.REPO_BRANCH_NAME) {
            return res.json({
                notification: "no edit proposal is open",
                error: 1
            });
        }

        git.repoByUid(req.session.uid).then(repo => {
            console.log("repo is " + JSON.stringify(repo));
            git.branch(repo, config.REPO_BRANCH_NAME, config.UPSTREAM_REPO_NAME, true).then(result => {
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

    repoBranchNameByUid(req.session.uid).then(curBranch => {
        if (curBranch == config.REPO_BRANCH_NAME) {
            return res.json({
                notification: "no edit proposal is open",
                error: 1
            });
        }

        git.repoByUid(req.session.uid).then(repo => {
            console.log("repo at " + repo.path());
            git.diffBranch(repo, config.REPO_BRANCH_NAME).then(diff => {
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

    let ep = req.path.replace("/_editProposal_/open/", "");
    console.log(ep);
    ep = ep.split(' ').join('_')
    if (ep == "") {
        return res.json({
            notification: "empty edit proposal name"
        });
    }

    repoBranchNameByUid(req.session.uid).then(curBranch => {
        if (curBranch != config.REPO_BRANCH_NAME) {
            return res.json({
                notification: "first close or submit your current proposal",
                error: 1
            });
        }

        git.repoByUid(req.session.uid).then(repo => {
            //res.json({notification: "ok" });
            console.log("repo is " + JSON.stringify(repo));
            git.branch(repo, ep, config.UPSTREAM_REPO_NAME, true).then(result => {
                console.log("branch " + result);
                req.session.editProposal = ep;
                return res.json({
                    notification: "opened edit proposal '" + ep + "'",
                    error: 0
                });
            }, err => {
                console.log("err " + err);
                return res.json({
                    notification: err,
                    error: 1
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


router.get('/_cvt_', function(req, res, next) {
    let jReply = {};
    jReply['STACKEDIT_URL'] = config.STACKEDIT_URL;
    jReply['STACKEDITOR_URL'] = config.STACKEDIT_URL;
    jReply['wikiPage'] = "";
    jReply['rawMarkdown'] = "";
    res.render('cvt', jReply);
});

router.use(handleAPage);




module.exports = router;
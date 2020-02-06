var auth = require("../auth.js");
var express = require('express');
var router = express.Router();

KnownUser = function(identity) {
    if (identity == "bitcoincash:qr8ruwyx0u7fqeyu5n49t2paw0ghhp8xsgmffesqzs")  // TODO store in config database or file
    {
        return true;
    }
    if (identity == "bitcoincash:qrwddp7gxl50fpl2tgz003zfahysks4w7yylm72h0m")
    {
        return true;
    }
    return false;
}

/* GET home page. */
router.get('/', function(req, res, next) {
    return handleAPage(req, res);
});

router.get('/_logout_', function (req, res, next) {
    req.session.challenge = undefined;
    req.session.uid = undefined;
    req.redirect("/");
});

router.get('/_commit_', function (req, res, next) {
    if (req.session.uid == undefined)
    {
        res.send("must log in first");
        return;
    }
    console.log("commit to repo");
    commitEdits(req,res);
    res.send("OK");
});

router.get('/_login_/auto', function(req, res, next) {
    console.log("connecting with session: " + req.sessionID);
    console.log("op=" + req.query.op);
    console.log("addr=" + req.query.addr);
    console.log("sig size: " + req.query.sig.length + " sig=" + req.query.sig);
    console.log("cookie=" + req.query.cookie);
    if (req.query.op == "login")
    {
        console.log("login");
        sessionStore.get(req.query.cookie, function(err, session) {
            if (err != null)
                console.log("session store: " + err.message);
            else
                console.log("got session for cookie");
        if (session != null)
        {
            if (!KnownUser(req.query.addr))
            {
                console.log("unknown user " + req.query.addr);
                res.status(200).send("unknown identity");
                return;

            }
            if (verifySig(req.headers.host + "_bchidentity_login_" + session.challenge, req.query.addr, req.query.sig))
            {
                sessionStore.get(req.query.cookie, function(err, session2) {
                    console.log("reloaded session: " + JSON.stringify(session2));
                });

                // If connect with same session I need to write req because changing the sessionStore directly will be overwritten
                // when this function returns.
                if (req.query.cookie == req.sessionID)
                {
                    req.session.challenge = "solved";
                    req.session.uid = req.query.addr;
                }
                else // If I connected with a different (out-of-band) session, then I need to write the sessionStore directly
                {
                    session.challenge = "solved";
                    session.uid = req.query.addr;
                    sessionStore.set(req.query.cookie, session, function(err) {
                        console.log("error?:" + JSON.stringify(err));
                    });
                }
                refreshRepo(req.query.addr);
                console.log("login accepted");
                res.status(200).send("login accepted");
                return;
            }
            else
            {
                console.log("bad signature for challenge " + req.headers.host + "_login_" + session.challenge);
                res.status(200).send("bad signature");
                return;
            }
        }
        else
            {
                console.log("unknown session");
                res.status(404).send("unknown session");
        }
        });
    }
    else
    {
        res.status(404).send("unknown operation");
    }
});

router.get('/_login_/check', function(req, res, next) {
    console.log("checking login status for:" + req.sessionID);
    console.log(JSON.stringify(req.session));

    if (req.session.uid != undefined)
    {
        //res.status(201).send("logged in");
        res.redirect("/");
        return;
    }
    res.status(401).send("login required");
});

router.get('/_login_', function(req, res, next) {
    if (req.session.challenge == undefined)
    {
        req.session.challenge = getChallengeString();
    }
    console.log("session challenge: " + req.session.challenge);
    var QRcodeText = "bchidentity://"+ req.headers.host + '/_login_/auto?op=login&chal=' + req.session.challenge + "&cookie=" + req.sessionID;
    user = { loggedIn: (req.session.uid != undefined) ? true: false };
    res.render('login', { challenge: req.headers.host + "_login_" + req.session.challenge, QRsignCode: QRcodeText, user: user });
});

router.post('/_login_', function(req, res, next) {
    console.log("_login_: POST of " + JSON.stringify(req.body));
    sess = req.session;
    if (req.headers.host + "_login_" + req.session.challenge != req.body.challenge)
    {
        res.send("stale challenge string");
    }
    else if (req.body.addr != "bchreg:qrqvm7fuwh2ml7svvggmyk79pp0ymr9e5ywghhxuja")  // TODO store in config database or file
    {
        res.send("unknown user");
    }
    else if (verifySig(req.body.challenge, req.body.addr, req.body.sig))
    {
        sess.uid = req.body.addr;
        res.redirect("/");
    }
    else
    {
        res.send("bad sig");
    }
});

router.use(handleAPage);




module.exports = router;

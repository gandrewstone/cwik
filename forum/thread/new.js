var fs = require('fs');
var gitapi = require("../gitapi.js");
var path = require("path");
var threadlistjs = require("../threadlist.js");

newThread = function(req, res)
{
    var user = GetUser(req);
    if (HasWritePermission(user) == false)
    {
        console.log("unauthorized write attempt!");
        res.status(401).send("login required");
        return;
    }
    // a GET will bring up the new thread page
    // a POST will submit the information on the page
    if (req.method == "GET")
    {
        res.render('newthread');
    }
    else if (req.method == "POST")
    {
        // the thread title is the name of the folder and the first post in a thread is the OP
        var titleOriginal = req.body["thread_title"];
        var repoRelativeFilePath = "threads/" + titleOriginal.replace(/ /g,"_") + "/post0_op.md";

        // using userForumRoot here excludes the mirror folder
        var filepath = userForumRoot + "/" + repoRelativeFilePath;

        var dirOfPost = path.dirname(filepath);
        if (!fs.existsSync(dirOfPost))
        {
            fs.mkdirSync(dirOfPost, { recursive: true });
        }
        else
        {
            res.send("error creating thread, thread with that name already exists");
            return;
        }
        var newpost = CreateNewPost(null, req.body["thread_body"], user);
        var joinedFilePath = path.join(GetWorkDir(), repoRelativeFilePath);
        try
        {
            fs.writeFileSync(joinedFilePath, newpost, 'utf8');
        }
        catch (err)
        {
            console.log("POST content file write error: " + err.message);
            res.send(err.message);
        }
        var changedFiles = [repoRelativeFilePath];
        if (UpdateThreadList(titleOriginal))
        {
            changedFiles.push(mdpath);
        }
        CommitToRepo(changedFiles, user);
        res.redirect("/forum");
    }
}

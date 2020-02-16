var fs = require('fs');
var gitapi = require("../gitapi.js");
var path = require("path");
var util = require("../util.js");

editPost = function(req, res)
{
    var user = GetUser(req);
    // remove the action from the path
    // TODO : find alternative method incase _new_post is somewhere else in the url other than the end
    decodedPath = decodedPath.replace('/_edit_post','');
    var filepath = userForumRoot + decodedPath;
    if (!filepath.endsWith(".md"))
    {
        filepath = filepath + ".md";
    }
    var data = "";
    try
    {
        data = fs.readFileSync(filepath);
    }
    catch (e)
    {
        console.log(e.message);
        data = "empty post";
    }
    var postHeader = GetHeaderDataFromPost(data);
    if (HasEditPermission(user, postHeader) == false)
    {
        console.log("unauthorized edit attempt!");
        res.status(401).send("login required");
        return;
    }
    if (IsThreadFrozen(user, postHeader))
    {
        console.log("unauthorized edit attempt! Thread is frozen");
        res.status(401).send("Thread is frozen");
        return;
    }
    // a GET will bring up the edit post page
    // a POST will submit the information on the page
    if (req.method == "GET")
    {
        console.log("ABOUT TO EDIT POST")
        res.render('editpost', { pagecontent: data });
    }
    if (req.method == "POST")
    {
        // no need to add one to post count because posts are 0 indexed
        var repoRelativeFilePath = decodedPath;
        if (!repoRelativeFilePath.endsWith(".md"))
        {
            repoRelativeFilePath = repoRelativeFilePath + ".md";
        }
        // using userForumRoot here excludes the mirror folder
        var filepath = userForumRoot + "/" + repoRelativeFilePath;

        var dirOfPost = path.dirname(filepath);
        if (!fs.existsSync(dirOfPost))
        {
            res.send("error editing post, thread does not exist");
            return;
        }
        // this is a redundant check
        if (!fs.existsSync(filepath))
        {
            res.send("error editing post, post does not exist");
            return;
        }
        var newpost = req.body["edited_post_body"];
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
        CommitToRepo(changedFiles, user);
    }
    res.redirect("/forum" + path.dirname(decodedPath));
    return;
}

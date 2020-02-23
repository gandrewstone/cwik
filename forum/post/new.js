var fs = require('fs');
var gitapi = require("../gitapi.js");
var path = require("path");
var util = require("../util.js");

CreateNewPost = function(title, body, user)
{
    var header = GenerateHeader(title, user);
    return header + body;
}

newPost = function(req, res, decodedPath)
{
    var user = GetUser(req);
    if (HasWritePermission(user) == false)
    {
        console.log("unauthorized write attempt!");
        res.status(401).send("login required");
        return;
    }
    // remove the action from the path
    // TODO : find alternative method incase _new_post is somewhere else in the url other than the end
    decodedPath = decodedPath.replace('_new_post','');
    var filepath = userForumRoot + decodedPath;
    if (!filepath.endsWith("post0_op.md"))
    {
        filepath = filepath + "post0_op.md";
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
    if (IsThreadFrozen(user, postHeader))
    {
        console.log("unauthorized edit attempt! Thread is frozen");
        res.status(401).send("Thread is frozen");
        return;
    }
    // a GET will bring up the new post page
    // a POST will submit the information on the page
    if (req.method == "GET")
    {
        console.log("ABOUT TO RENDER NEW POST")
        res.render('newpost');
    }
    if (req.method == "POST")
    {
        // trim leading /
        decodedPath = decodedPath.substr(1);
        // TODO : we probably want to add some thread safety here by using .lock files or a similar mechanism
        var postcount = GetPostCountInThread(decodedPath);
        // no need to add one to post count because posts are 0 indexed
        var repoRelativeFilePath = decodedPath + "post" + postcount + ".md";
        // using userForumRoot here excludes the mirror folder
        var filepath = userForumRoot + "/" + repoRelativeFilePath;

        var dirOfPost = path.dirname(filepath);
        if (!fs.existsSync(dirOfPost))
        {
            res.send("error creating post, thread does not exist");
            return;
        }
        var newpost = CreateNewPost(null, req.body["post_body"], user);
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
    res.redirect("/forum/" + decodedPath);
    return;
}

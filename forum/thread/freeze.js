var fs = require('fs');
var gitapi = require("../gitapi.js");
var headerjs = require("../header.js");
var path = require("path");
var util = require("../util.js");

freezeThread = function(req, res, decodedPath)
{
    var user = GetUser(req);
    if (HasFreezePermission(user) == false)
    {
        console.log("unauthorized freeze attempt!");
        res.status(401).send("insufficient permissions");
        return;
    }
    // There is no POST request
    // a GET will toggle the freeze on the thread
    if (req.method == "GET")
    {
        // remove the action from the path
        // TODO : find alternative method incase _freeze_thread is somewhere else in the url other than the end
        decodedPath = decodedPath.replace('_freeze_thread','');
        // trim leading /
        decodedPath = decodedPath.substr(1);
        // we want the dir not the first post
        decodedPath = path.dirname(decodedPath);
        // using userForumRoot here excludes the mirror folder
        var filepath = userForumRoot + "/" + decodedPath;
        if (!fs.existsSync(filepath))
        {
            res.send("error reading thread, thread does not exist");
            return;
        }
        // get all the posts
        var posts = GetAllPostsInThread(decodedPath);
        // read all of the posts
        var changedFiles = [];
        for (index = 0; index < posts.length; index++)
        {
            var postpath = ""
            if ( index == 0)
            {
                postpath = decodedPath + "/post" + String(index) + "_op.md";
            }
            else
            {
                postpath = decodedPath + "/post" + String(index) + ".md";
            }
            var post = GetPost(postpath, index, user, false);
            var postHeader = GetHeaderDataFromPost(post);
            // we already validated we have freeze permissions earlier
            ToggleFreezePMD(postHeader);
            // rebuild the post with the new doc
            var newData = RebuildPost(postHeader, post);
            var joinedFilePath = ""
            if (index === 0)
            {
                joinedFilePath = filepath + "/post0_op.md";
            }
            else
            {
                joinedFilePath = filepath + "/post" + String(index) + ".md";
            }
            try
            {
                fs.writeFileSync(joinedFilePath, newData, 'utf8');
            }
            catch (err)
            {
                console.log("POST content file write error when toggling freeze: " + err.message);
                res.send(err.message);
            }
            changedFiles.push(postpath);
        }
        CommitToRepo(changedFiles, user);
    }
    res.redirect("/forum/");
    return;
}

var fs = require('fs');
var path = require("path");

GetAllPostsInThread = function(threadPath)
{
    var folderpath = userForumRoot + "/" + threadPath;
    return fs.readdirSync(folderpath);
}

GetPostCountInThread = function(threadPath)
{
    var folderpath = userForumRoot + "/" + threadPath;
    var files = fs.readdirSync(folderpath);
    return files.length;
}

/* Turns a wiki path into a link */
ForumLinkify = function(s)
{
    var text = s.split("/").slice(-1)[0].replace("__"," ")
    return '<a href=\"' + s + '">' + text + '</a>'
}

IsThreadFolder = function(decodedPath)
{
    return (decodedPath.startsWith("/threads/") && !decodedPath.endsWith(".md"));
}

GenerateForumMenu = function(decodedPath)
{
    var menu = "";
    menu = menu + "<div> <a href='/forum/_new_thread'> Create a new thread </a> </div>"
    if (IsThreadFolder(decodedPath))
    {
        menu = menu + "<div> <a href='/forum" + decodedPath + "/_new_post'> Create a new post </a> </div>"
    }
    return menu;
}

GetUser = function(req)
{
    if (req.session.uid == undefined)
    {
        return undefined;
    }
    return req.session.uid.split(":")[1];
}

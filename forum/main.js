/// THIS FILE HANDLES ROUTES WITHIN THE FORUM SECTION OF THW WEBSITE

var forum_repo = require("./git_config.json");
var fs = require('fs');
var git = require("nodegit");
var pagedown = require("pagedown");
var path = require("path");
var post_edit = require("./post/edit.js");
var post_new = require("./post/new.js")
var post_read = require("./post/read.js");
var thread_freeze = require('./thread/freeze.js');
var thread_new = require("./thread/new.js");
var thread_new_quoted = require("./thread/new_quoted.js");
var thread_read = require("./thread/read.js");
var sanitizer = require("sanitize-html");
var util = require("./util.js");

function BadForumURL(req, res)
{
    res.status(404).send('Sorry, we cannot find that forum page!')
}

function ValidatePath(UrlPath)
{
    decodedPath = decodeURI(urlPath);
    decodedPath = decodedPath.replace(" ", "__"); // replace spaces with double underscore
    decodedPath = decodedPath.toLowerCase();  // forum pages are not case sensitive
    /// TODO : find a solution for the coment below
    /*
    decodedPathCopy = JSON.parse(JSON.stringify(decodedPath));
    var sections = decodedPathCopy.split("/");
    for (i = 0; i < sections.length; i++)
    {
        if (sections[i].startsWith("."))
        {
            return BadForumURL(req, res);  // Don't allow overwriting dot files
        }
    }
    */
    if (decodedPath.includes(".."))
    {
        return BadForumURL(req, res);
    }
    if (decodedPath.startsWith("/forum"))
    {
        // remove the forum part
        decodedPath = decodedPath.substr(6);
    }
    return decodedPath;
}

handleForum = function(req, res)
{
    console.log("handle a page: " + req.path);
    /// Validate the path to check basic formatting and remove any elements that are common for all forum pages
    decodedPath = ValidatePath(req.path);
    // if we are on the /forum page, read the thread list
    if (decodedPath == "" || decodedPath == "/")
    {
        decodedPath = "/threads.md";  // hard code / to threads.md
    }
    console.log("decodedPath = " + decodedPath);
    /// is this an action? actions can be run from anywhere but always end with the action command
    if (decodedPath.endsWith("_new_thread"))
    {
        // newthread doesnt need decodedPath, it will always just make a new thread in the threads folder
        return newThread(req, res);
    }
    else if (decodedPath.endsWith("_new_thread_quoted"))
    {
        return newThreadQuoted(req, res);
    }
    else if (decodedPath.endsWith("_freeze_thread"))
    {
        return freezeThread(req, res, decodedPath);
    }
    else if (decodedPath.endsWith("_new_post"))
    {
        return newPost(req, res, decodedPath);
    }
    else if (decodedPath.endsWith("_edit_post"))
    {
        return editPost(req, res, decodedPath);
    }
    /// it isnt an action, is it a thread?
    else if (IsThreadFolder(decodedPath))
    {
        return readThread(req, res, decodedPath);
    }
    /// it isnt an action or a thread, it must be a specific page/post
    else
    {
        return readPost(req, res, decodedPath)
    }
}

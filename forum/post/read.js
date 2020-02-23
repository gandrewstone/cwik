var fs = require('fs');
var headerjs = require("../header.js");
var pagedown = require("pagedown");
var path = require("path");
var sanitizer = require("sanitize-html");
var util = require("../util.js");

RebuildPost = function(newPostHeader, fullPost)
{
    var newPost = ConvertHeaderToHTML(newPostHeader);
    var postBody = fullPost = fullPost.split("</div>")[1];
    newPost = newPost + postBody;
    return newPost;
}

GetPost = function(relativePath, index, user, links = true)
{
    var data = "";
    try
    {
        var filepath = userForumRoot + "/" + relativePath;
        if (!filepath.endsWith(".md"))
        {
            filepath = filepath + ".md";
        }
        data = fs.readFileSync(filepath);
    }
    catch (e)
    {
        console.log(e.message);
        data = "empty post";
    }
    var postHeader = GetHeaderDataFromPost(data);
    var editButton = "";
    if (links && IsThreadFrozen(user, postHeader) == false)
    {
        if (HasEditPermission(user, postHeader))
        {
            if (relativePath.endsWith(".md"))
            {
                relativePath = relativePath.substring(0, relativePath.length - 3);
            }
            editButton = "\n\n<a href='/forum" + relativePath + "/_edit_post'> EDIT POST</a>";
        }
    }
    var freezeButton = "";
    if (links && HasFreezePermission(user))
    {
        if (relativePath.endsWith(".md"))
        {
            relativePath = relativePath.substring(0, relativePath.length - 3);
        }
        if (relativePath.endsWith("post0_op"))
        {
            freezeButton = "\n\n<a href='/forum" + relativePath + "/_freeze_thread'> Freeze Thread</a>";
        }
    }

    var doc = "### Post" + String(index) + " ###\n\n" + data + editButton + freezeButton + "\n\n";
    // Convert markdown to html
    var cvt = new pagedown.Converter();
    var post = cvt.makeHtml(doc);
    return post;
}

readPost = function(req, res, decodedPath)
{
    var user = GetUser(req);
    if (req.method == "GET")
    {
        html = GetPost(decodedPath, 0, user);
        var historyHtml="";
        if (req.session.history == undefined)
        {
            req.session.history = [];
        }
        else
        {
            historyHtml = req.session.history.map(ForumLinkify).join("<br/>\n")
        }
        // Remove this url if we've already been there
        var historyPath = urlPath;
        if (urlPath == "/")
        {
            historyPath = "/home";
        }
        var index = req.session.history.indexOf(historyPath);
        if (index !== -1)
        {
            req.session.history.splice(index, 1);
        }
        // And add it to the end
        req.session.history.push(historyPath);
        // Trim to no more than the last 10 places
        if (req.session.history.length > 10)
        {
            req.session.history.splice(0, req.session.history.length-10);
        }
        var headings = "";
        appendHeading = function(tagName, text, attribs)
        {
            // console.log("TAG: " + tagName + " " + text)
            headings += '<div class="toc_' + tagName + '"><a href="' + decodedPath + "/" + attribs.href + '">' + text + "</a></div>\n"
        };
        // console.log("HEADINGS: " + headings)
        html = sanitizer(html,
        {
            allowedTags: sanitizer.defaults.allowedTags.concat([ 'p', 'a' ]),
            exclusiveFilter: function(frame)
            {
                if (frame.tag == "a")
                {
                    appendHeading(frame.tag, frame.text, frame.attribs);
                }
                return false;  // Don't remove anything based on this filter -- I am just trying to extract headings
            }
        });
        user = { loggedIn: (req.session.uid != undefined) ? true: false };
        menu = GenerateForumMenu(decodedPath);
        res.render('forum', { pagecontent: html, structure: headings, thisPage: urlPath, history: historyHtml, user: user, menu: menu });
    }
}

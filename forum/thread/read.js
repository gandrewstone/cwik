var fs = require('fs');
var headerjs = require("../header.js");
var pagedown = require("pagedown");
var path = require("path");
var sanitizer = require("sanitize-html");
var util = require("../util.js");

readThread = function(req, res, decodedPath)
{
    var user = GetUser(req);
    // a GET will bring up the thread
    // there is no post action
    if (req.method == "GET")
    {
        // using userForumRoot here excludes the mirror folder
        var filepath = userForumRoot + decodedPath;
        if (!fs.existsSync(filepath))
        {
            res.send("error read thread, thread does not exist");
            return;
        }
        // get all the posts
        var posts = GetAllPostsInThread(decodedPath);
        // read all of the posts
        var postData = [];
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
            var post = GetPost(postpath, index, user);
            postData.push(post);
        }
        // we should have all post data at this point in the postData array
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
        var historyIndex = req.session.history.indexOf(historyPath);
        if (historyIndex !== -1)
        {
            req.session.history.splice(historyIndex, 1);
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
        /*
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
        */
        user = { loggedIn: (req.session.uid != undefined) ? true: false };
        menu = GenerateForumMenu(decodedPath);
        // consolidate all the post data into one var
        var allData = "";
        for (i = 0; i < postData.length; i++)
        {
            allData = allData + postData[i];
        }
        res.render('forum', { pagecontent: allData, structure: headings, thisPage: urlPath, history: historyHtml, user: user, menu: menu });
    }
    return;
}

var fs = require('fs');
var pagedown = require("pagedown");
var sanitizer = require("sanitize-html");
var git = require("nodegit");
var path = require("path");


var ncp = require('ncp').ncp;
ncp.limit = 16;  // number of simultaneous copy operations allowed

var titles = ["h1","h2","h3","h4","h5","h6"]

/* Turns a wiki path into a link */
function WikiLinkify(s) {
    var text = s.split("/").slice(-1)[0].replace("__"," ")
    return '<a href=\"' + s + '">' + text + '</a>'
}


function BadURL(req, res) {
    res.status(404).send('Sorry, we cannot find that!')
}

// All files that are modified are stored in a file so that we know what to commit.
// Perhaps this can be better accomplished with a git command
changedFiles = new Set();

commitEdits = function(req, res) {
    var user = req.session.uid.split(":")[1];
    var userSpace = userForkRoot + "/" + user;
    console.log("commit edits run: " + user + " repo " + userSpace);
    git.Repository.open(userSpace).then(
        function(repo)
        {
            console.log("then");
            var author = git.Signature.now(user, user + "@bitcoin.cash");
            var committer = git.Signature.now("buwiki","buwiki@protonmail.com");
            console.log("author " + user + "@bitcoin.cash");
            console.log("committer " + "buwiki@protonmail.com");
            files = Array.from(changedFiles.keys());
            console.log("files " + JSON.stringify(files));
            repo.createCommitOnHead(files, author, committer, "wiki commit").then(
                function (oid) {
                    console.log("worked " + oid);
                    changedFiles.clear();
                    saveChangedFiles(req.session.uid);
                },
                function (failure) {
                    console.log("failed" + failure);
                });
        }, function(failure) {
            console.log("fail");
            //console.log("failed! " + JSON.stringify(failure));
        });
}

// Load the list of changed files from disk.
loadChangedFiles = function(uid)
{
    var userSpace = userForkRoot + "/" + uid.split(":")[1];
    var filepath = userSpace + "/.changedFiles.lst";
    console.log("load edited files from: " + filepath);
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err)
        {
            console.log("load error: " + err);
            return;
        }
        changedFiles = new Set(JSON.parse(data));
        console.log("edited file list: " + JSON.stringify(Array.from(changedFiles.keys())));
    });
}

// Save the list of changed files to a file on disk.
saveChangedFiles = function(uid)
{
    console.log("saveChangedFiles " + uid);
    var userSpace = userForkRoot + "/" + uid.split(":")[1];
    console.log("userSpace " + userSpace);
    var filepath = userSpace + "/.changedFiles.lst";
    console.log("writing file change list: " + filepath);
    console.log(JSON.stringify(Array.from(changedFiles.keys())));
    fs.writeFile(userSpace + "/.changedFiles.lst", JSON.stringify(Array.from(changedFiles.keys())), (err) => {
                if (err)
                    console.log("changed list write error: " + JSON.stringify(err));
                else
                    console.log("changed list written");
            });
}


handleAPage = function(req, res) {

    if (req.session.uid == undefined)  // For now, require login
    {
        return res.redirect(307,"/_login_")
    }

    var userSpace = userForkRoot + "/" + req.session.uid.split(":")[1];
    var readFrom = userSpace;
    console.log("User space: " + userSpace);
    // Make a working space for this user if one does not yet exist
    if (!fs.existsSync(userSpace))
    {
        ncp(contentHome, userSpace, function (err) {
            if (err)
            {
                return console.error("ncp copy error: " + err);
            }
            console.log("user scratch space created!");
            // TODO what?
        });

        readFrom = contentHome;  // While I'm waiting for the copy, allow the user to read
    }

    console.log("handle a page: " + req.path);
    if (req.path == "/favicon.ico")
    {
        res.sendFile("public/images/icon.ico");
        return;
    }
    
    urlPath = req.path;
    console.log(urlPath);
    console.log(decodeURI(urlPath));
    decodedPath = decodeURI(urlPath);
    decodedPath = decodedPath.replace(" ", "__"); // replace spaces with double underscore
    decodedPath = decodedPath.toLowerCase();  // wiki pages are not case sensitive
    if (decodedPath.startsWith(".")) return BadURL(req, res);  // Don't allow overwriting dot files
    if (decodedPath.includes("..")) return BadURL(req, res);
    if (decodedPath == "/") decodedPath = "/home";  // hard code / to home.md
    if (decodedPath.endsWith("/")) decodedPath = decodedPath.substring(0,decodedPath.length-1);
    var filepath = readFrom + decodedPath + ".md";
    console.log("access " + filepath);

    if (req.method == "POST")
    {
        var repoRelativeFilePath = decodedPath.slice(1) + ".md";  // Chop off the initial /
        var writeFilePath = userSpace + repoRelativeFilePath;
        // requires app.use(bodyParser.text({type: 'text/plain'}));
        console.log(writeFilePath + ": POST of " + JSON.stringify(req.body));
        console.log("user: " + req.session.uid);
        if (req.session.uid == undefined)
        {
            console.log("unauthorized edit attempt!");
            res.status(401).send("login required");
            return;
        }

        if (!changedFiles.has(repoRelativeFilePath))
        {
            changedFiles.add(repoRelativeFilePath);
            console.log("SCF");
            saveChangedFiles(req.session.uid);
            console.log("SCF DINE");
        }
        
        fs.writeFile(filepath, req.body, (err) => {
            if (err)
            {
                console.log("file write error: " + err.message);
                res.send(err.message);
            }
            else
            {
                console.log("file write success");
                res.send("ok");
            }
        });
        return;
    }
    
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) data = "empty page";
            //return AskCreatePage(urlPath, req, res);

        if (req.query.raw)
        {
            //console.log("RAW:" + data);
            res.send(data);
            return;
        }

        var historyHtml="";
        if (req.session.history == undefined) req.session.history = [];
        else
        {
            historyHtml = req.session.history.map(WikiLinkify).join("<br/>\n")
        }

        // Remove this url if we've already been there
        var historyPath = urlPath;
        if (urlPath == "/") historyPath = "/home";

        var index = req.session.history.indexOf(historyPath);
        if (index !== -1) req.session.history.splice(index, 1);
        // And add it to the end
        req.session.history.push(historyPath);
        // Trim to no more than the last 10 places
        if (req.session.history.length > 10)
        {
            req.session.history.splice(0, req.session.history.length-10);
        }

        var meta = null;
        var doc = data;

/*
        // Discover, parse, and remove any metadata
        console.log(doc.slice(0,12));
        if (doc.slice(0,12) == "metadata = {")
        {
            var end = doc.indexOf(";");
            if (end != -1)
            {
                metaText = doc.slice(11,end);
                doc = doc.slice(end+1);
                meta = JSON.parse(metaText);
                console.log("doc is " + doc);
            }
        }
*/
        
        // Convert markdown to html
        var cvt = new pagedown.Converter();
        var html = cvt.makeHtml(doc);

        var headings = "";
        var error = "";
        appendHeading = function(tagName, text, attribs) {
            // console.log("TAG: " + tagName + " " + text)
            headings += '<div class="toc_' + tagName + '"><a href="#' + text + '">' + text + "</a></div>\n"
        };
        // console.log("HEADINGS: " + headings)
        html = sanitizer(html, {
            allowedTags: sanitizer.defaults.allowedTags.concat([ 'img', 'h1', 'h2' ]),
            exclusiveFilter: function(frame) {
                if (titles.includes(frame.tag)) appendHeading(frame.tag, frame.text, frame.attribs);
                if (frame.tag == "div" && frame.attribs["class"] == "cwikmeta")
                {
                    try
                    {
                        meta = JSON.parse(frame.text);
                    }
                    catch(err)
                    {
                        error += err.message;
                    }
                    return true;
                }
                return false;  // Don't remove anything based on this filter -- I am just trying to extract headings
            }
        });
        //console.log("META: " + JSON.stringify(meta))
        //console.log(html);
        title = ""
        related = ""
        if (meta)
        {
            if (meta.title) title = meta.title
            if (meta.related) related = meta.related.map(WikiLinkify).join("<br/>\n")
        }

        user = { loggedIn: (req.session.uid != undefined) ? true: false };
        res.render('wikibrowse', { zzwikiPage: "loading...", structure: headings, title: title, related: related, thisPage: urlPath, rawMarkdown:data, history: historyHtml, user: user });
    })
}

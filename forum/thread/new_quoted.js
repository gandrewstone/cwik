var fs = require('fs');
var path = require("path");

newThreadQuoted = function(req, res)
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
        var quoted_text = "";
        if (req.body["quoted_filename"] != undefined)
        {
            quoted_filename = req.body["quoted_filename"];
            console.log(quoted_filename);

            // using userForumRoot here excludes the mirror folder
            var filepath = contentHome + "/" + quoted_filename;
            if (!fs.existsSync(filepath))
            {
                // if it doesnt exist then just render the newthread page
                res.render('newthread', {"quoted_text" : quoted_text});
            }
            try
            {
                quoted_text = fs.readFileSync(filepath);
            }
            catch (e)
            {
                console.log(e.message);
                // if there is an error then just render the newthread page
                res.render('newthread', {"quoted_text" : quoted_text});
            }
            console.log("about to render quoted");
            console.log("quoted text = " + quoted_text);
        }
        res.render('newthread', {"quoted_text" : quoted_text});
    }
}

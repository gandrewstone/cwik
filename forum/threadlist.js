var fs = require('fs');
var path = require("path");

// using userForumRoot here excludes the mirror folder
mdpath = "threads.md";
mdTemplate = "\n# All Threads #\n";

function NewThreadList()
{
    var result = true;
    try
    {
        var fd = fs.openSync(userForumRoot + "/" + mdpath, 'a');
        fs.writeFileSync(fd, mdTemplate, 'utf8');
    }
    catch (err)
    {
        console.log("Thread List creation file write error: " + err.message);
        res.send(err.message);
        result = false;
    }
    finally
    {
        if (fd !== undefined)
        {
            fs.closeSync(fd);
        }
    }
    return result;
}

function AppendToThreadList(title)
{
    var result = true;
    var title_no_spaces = title.replace(/ /g,"_");
    var formattedTitle = "[" + title + "](/forum/threads/" + title_no_spaces + ")" + "\n";
    try
    {
        var fd = fs.openSync(userForumRoot + "/" + mdpath, 'a');
        // this is a hack to get proper spacing in md file
        // adding more newlines to get the extra line in the formattedTitle does not work
        fs.appendFileSync(fd, "\n");
        fs.appendFileSync(fd, formattedTitle);
    }
    catch (err)
    {
        console.log("Thread List append file write error: " + err.message);
        res.send(err.message);
        result = false;
    }
    finally
    {
        if (fd !== undefined)
        {
            fs.closeSync(fd);
        }
    }
    return result;
}

UpdateThreadList = function(title)
{
    if (!fs.existsSync(userForumRoot + "/" + mdpath))
    {
        if (!NewThreadList())
        {
            return false;
        }
    }
    return AppendToThreadList(title);
}

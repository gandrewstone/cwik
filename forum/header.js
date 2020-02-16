ConvertHeaderToHTML = function(data)
{
    var opener = '<div class="cwikmeta"> ';
    var closer = ' </div>';
    var header = opener + JSON.stringify(data) + closer;
    return header;
}

function GenerateDefaultHeaderData(title)
{
    if (title == null)
    {
        title = "";
    }
    var headerdata = { "title": title, "related": [] };
    return headerdata;
}

GenerateHeader = function(title, user)
{
    var dHeader = GenerateDefaultHeaderData(title);
    var dPMD = GeneratePMD(user);
    var rawheader = Object.assign({}, dHeader, dPMD);
    var header = ConvertHeaderToHTML(rawheader);
    return header;
}

GetHeaderDataFromPost = function(postBodyBuffer)
{
    var postBody = postBodyBuffer.toString();
    if (postBody == undefined)
    {
        return;
    }
    // header info should always be first so this should always work
    postBody = postBody.split("</div>")[0];
    if (postBody == undefined)
    {
        return;
    }
    postBody = postBody.split('<div class="cwikmeta">')[1];
    if (postBody == undefined)
    {
        return;
    }
    var headerData = JSON.parse(postBody);
    return headerData;
}

function updateDict(a, b) {
    for (let [key, value] of Object.entries(b)) {
        a[key] = value;
    }
}

/* Turns a wiki path into a link */
function WikiLinkify(s) {
    var text = s.split("/").slice(-1)[0].replace("__", " ")
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3)
    return '<a class="histL" href=\"' + s + '">' + text + '</a>'
}


/* Creates a js-handled link to an anchor i.e. # -- an internal link to a different document section.  Click calls the client-side js function jumpTo. */
/*
function JumpToLinkify(s, cls) {
    var text = s.split("/").slice(-1)[0].replace("__", " ");
    text = text.replace("/","");  // drop any /s
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3);
    //return '<a class="histL" href=\"' + s + '">' + text + '</a>'
    var ret = '<div class="l' + cls + '"></span><span class="i' + cls + '" onclick="jumpTo(\'' + text + '\')">' + text + "</span></div>\n";
    //let ret = '<div class="ltoc_' + cls + '"><span class="itoc_' + cls + '" onclick="jumpTo(\'' + text + '\')">' + text + "</span></div>\n";
    console.log(ret)
    return ret;
}
*/

/* Creates a js-handled link to another document.  Click calls the client-side js function "linkTo" */
function LinkToLinkify(s, cls) {
    var text = s.split("/").slice(-1)[0].replace("__", " ");
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3);
    var ret = '<div class="l' + cls + '"' + ' onclick="linkTo(\'' + text + '\')"><span class="i' + cls + '">' + text + "</span></div>\n";
    // console.log(ret);
    return ret;
}


exports.LinkToLinkify = LinkToLinkify;
exports.WikiLinkify = WikiLinkify;
exports.updateDict = updateDict;

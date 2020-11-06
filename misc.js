var fs = require('fs').promises;
var path = require('path');


function userDir(uid) {
    return uid.split(":")[1];
}


function updateDict(a, b) {
    for (let [key, value] of Object.entries(b)) {
        a[key] = value;
    }
}

function HeadingToAnchor(text) {
    var s = text.toLowerCase().split(/\s/).join("-");
    s = s.replace("/", "");
    s = s.replace(":", "");
    s = s.replace("?", "");
    s = s.replace("!", "");
    s = s.replace("(", "");
    s = s.replace(")", "");
    return s;
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
    let linkText = s.replace("__", " ");
    let pagename = s.split("/").slice(-1)[0].replace("__", " ");
    if (pagename.length >= 3 && pagename.slice(pagename.length - 3, pagename.length) == ".md")
        pagename = pagename.slice(0, pagename.length - 3);
    let pageloc = s.split("/").slice(1,-1)
    pageloc = pageloc.join(":")
    if (pageloc) pageloc = " (in " + pageloc + ")"
    let ret = '<a class="l' + cls + '"' + ' href="' + linkText + '"><span class="i' + cls + '">' + pagename + pageloc + "</span></a>\n";
    //let ret = '<a class="l' + cls + '"' + ' href="' + linkText + '">' + pagename + pageloc + "</a>\n"
    //console.log("Link2Linkify " + s + " -> " + ret);
    return ret
}

function flat1nullfilter(lst) {
    let ret = [];
    for (let i = 0; i < lst.length; i++) {
        if (Array.isArray(lst[i])) ret = ret.concat(lst[i]);
        else if (lst[i] != null)
            ret.push(lst[i]);
    }
    return ret;
}

function allSettled() {
    let promiseList = flat1nullfilter(arguments)
    // console.log(promiseList);
    let results = new Array(promiseList.length);

    return new Promise((ok, rej) => {

        let fillAndCheck = function(i) {
            return function(ret) {
                results[i] = ret;
                for (let j = 0; j < results.length; j++) {
                    if (results[j] == null) return;
                }
                ok(results);
            }
        };

        for (let i = 0; i < promiseList.length; i++) {
            promiseList[i].then(fillAndCheck(i), fillAndCheck(i));
        }
    });
}

// See https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
async function* getFiles(dir) {
    const dirents = await fs.readdir(dir, {
        withFileTypes: true
    });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else {
            yield res;
        }
    }
}

exports.getFiles = getFiles;
exports.LinkToLinkify = LinkToLinkify;
exports.WikiLinkify = WikiLinkify;
exports.updateDict = updateDict;
exports.allSettled = allSettled;
exports.userDir = userDir;
exports.HeadingToAnchor = HeadingToAnchor;

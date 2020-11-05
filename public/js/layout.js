
var EPHEMERAL_SIDEBAR_SIZE = 600; // If the screen width is smaller than this, auto-hide the sidebar
var NOTIFICATION_DELAY = 15000;

var lastSearch = "";

// TODO, get this from config.js
var MEDIA_EXT = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".ogg", ".wav", ".apk", ".zip", ".tgz"];

function isMedia(filepath) {
    if (filepath == undefined) return null;
    for (let i = 0; i < MEDIA_EXT.length; i++) {
        if (filepath.endsWith(MEDIA_EXT[i])) {
            return MEDIA_EXT[i];
        }
    }
    return null;
}

// see: https://stackoverflow.com/questions/384286/how-do-you-check-if-a-javascript-object-is-a-dom-object
function isElement(element) {
    return element instanceof Element || element instanceof HTMLDocument;  
}

// see: https://stackoverflow.com/questions/8335834/how-can-i-hide-the-android-keyboard-using-javascript
function hideKeyboard(element) {
    // console.log(element);
    element.setAttribute('readonly', 'readonly'); // Force keyboard to hide on input field.
    element.setAttribute('disabled', 'true'); // Force keyboard to hide on textarea field.
    setTimeout(function() {
        element.blur(); //actually close the keyboard
        // Remove readonly attribute after keyboard is hidden.
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
    }, 100);
}

function jumpTo(spot) {
    // the innerWidth check lets us simulate this on the PC
    if ((window.innerWidth < EPHEMERAL_SIDEBAR_SIZE) || (window.matchMedia("(orientation: portrait)").matches)) {
        // by delaying a tiny bit the user sees click feedback
        setTimeout(hideSidebar, 100);
        setTimeout(() => jumpToWithoutClosingSidebar(spot), 120); // Defer execution so sidebar can be closed so the position is correct
    } else jumpToWithoutClosingSidebar(spot);
}

function jumpToWithoutClosingSidebar(spot) {
    let LAYOUT_HEADER_PX = document.getElementById("cwikheader").offsetHeight;
    if (LAYOUT_HEADER_PX == undefined) {
        LAYOUT_HEADER_PX = 30;
    }
    var s = spot.toLowerCase().split(/\s/).join("-");
    s = s.replace("/", "");
    s = s.replace(":", "");
    s = s.replace("?", "");
    s = s.replace("!", "");
    s = s.replace("(", "");
    s = s.replace(")", "");
    // console.log("jumpTo " + s);
    var e = document.getElementById(s);
    if (e) {
        //e.scrollIntoView(true);
        //window.scrollBy(0,-30);

        const y = e.getBoundingClientRect().top + window.pageYOffset - LAYOUT_HEADER_PX;
        window.scrollTo({
            top: y,
            behavior: 'smooth'
        });
    } else {
        console.log("unknown spot " + s);
    }
}

function linkTo(spot) {
    // the innerWidth check lets us simulate this on the PC
    if ((window.innerWidth < EPHEMERAL_SIDEBAR_SIZE) || (window.matchMedia("(orientation: portrait)").matches)) {
        // by delaying a tiny bit the user sees click feedback
        setTimeout(hideSidebar, 100);
        setTimeout(() => fetchJsonFor(spot), 120); // Defer execution so sidebar can be closed so the position is correct
    } else fetchJsonFor(spot);
}

function fetchJsonFor(spot) {
    let wc = document.querySelector('.wikicontent')
    // Our current page template isn't capable of showing wiki pages so reload the entire page
    if (wc == null) {
        window.location.href = spot;
        return;
    }

    var s = spot.toLowerCase().split(/\s+/).join("__");
    if (s.endsWith(".md")) s = s.slice(0, s.length - 3);

    let anchor = null;
    let jreq = null;
    if (s.includes('#')) { // is there an anchor
        let spanchor = s.split("#")
        anchor = spanchor[1];
        jreq = spanchor[0] + "?json=1" + "#" + anchor;
    } else jreq = s + "?json=1"

    // console.log("Requesting: " + jreq)
    fetch(jreq).then(response => {
        // console.log(response);
        return response.json();
    })
        .then(json => {
            // console.log("process json");
            if (json.anchor == null) json.anchor = anchor;
            processJsonPage(json);
            window.history.pushState({
                "json": json,
                "pageTitle": json.thisPage
            }, "", json.thisPage);
        });
    return s;
}

function logout() {
    fetch("/_logout_").then(function(data) {
        window.location.reload(false);
    });
}

function login() {
    window.location.href = "/_login_";
}


function pdfExport() {
    const url = new URL(window.location.href);
    let split = url.pathname.split("/");
    let filename = split[split.length-1] + ".pdf";
    let element = document.createElement('a');

    fetch("/_pdf_" + url.pathname)
        .then(resp => resp.blob())
        .then(blob => blob.arrayBuffer())
        .then(function(data) {
            element.setAttribute('href', 'data:application/pdf;base64,' + base64ArrayBuffer(data));
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            element.remove();
        });
}


function loginPolling() {
    var intervalID = setInterval(function() {
        fetch("/_login_/check").then(response => {
            if (response.status == 200) {
                window.location.href = "/";
            }
            if (response.status != 401) clearInterval(intervalID);
        });
    }, 5000);
}

function commitEdits() {
    notification({
        notification: "executing commit operation"
    });
    fetch("/_commit_").then(response => response.json().then(notification));
}

/* Creates a js-handled link to another document.  Click calls the client-side js function "linkTo" */
function LinkToLinkify(s, cls) {
    //var text = s.split("/").slice(-1)[0].replace("__", " ");
    let text = s.replace("__", " ");
    if (text.length >= 3 && text.slice(text.length - 3, text.length) == ".md")
        text = text.slice(0, text.length - 3);

    let show = text;
    if (show[0] == "/") show = show.slice(1, show.length);

    // console.log(s + " => " + text);
    var ret = '<div class="l' + cls + '"' + ' onclick="linkTo(\'' + text + '\')"><span class="i' + cls + '">' + show + "</span></div>\n";
    return ret;
}


function updatePage(json) {
    if (typeof json.related !== "undefined") { // undefined means don't touch
        let relBubble = document.getElementById("related");
        if (Array.isArray(json.related) && (json.related.length > 0)) {
            // console.log(json.related);
            let relatedStr = "";
            for (let i = 0; i < json.related.length; i++) {
                relatedStr = relatedStr.concat(LinkToLinkify(json.related[i], "rel"));
            }
            document.getElementById("relatedI").innerHTML = relatedStr;
            sidebarGrid.show(relBubble);
            sidebarGrid.refreshItems().layout();
        } else { // if its not an array, hide it
            document.getElementById("relatedI").innerHTML = "";
            sidebarGrid.hide(relBubble);
            sidebarGrid.refreshItems().layout();
        }
    }

    if (typeof json.structure !== "undefined") { // undefined means don't touch
        let bubble = document.getElementById("structure");
        let ctnt = document.getElementById("structureI");
        if (json.structure.length > 0) {
            ctnt.innerHTML = json.structure;
            sidebarGrid.show(bubble);
        } else {
            ctnt.innerHTML = "";
            sidebarGrid.hide(bubble);
        }
    }

    document.getElementById("historyI").innerHTML = json.history;
    document.getElementById("pageTitle").innerHTML = json.title;

    sidebarGrid.refreshItems().layout();

    if (typeof json.rawMarkdown !== "undefined") {
        document.getElementById("rawMarkdown").value = json.rawMarkdown;
    }

    // undefined means leave as is, "" means no edit proposal
    if (typeof json.user.editProposal !== "undefined") {
        let epInput = document.getElementById("editProposal");
        if (epInput) {
            // console.log("EP: " + json.user.editProposal);
            epInput.value = json.user.editProposal;
        }
    }
}

function hideSidebar() {
    sb = document.querySelector(".leftsidebar");
    sb.style.display = "none";
    document.getElementById("sideBarButton").src = '/_static_/images/openmenuIcon.svg';
}

function showSidebar() {
    sb = document.querySelector(".leftsidebar");
    sb.style.display = "flex";
    document.getElementById("sideBarButton").src = '/_static_/images/closemenuIcon.svg';
    sidebarGrid.refreshItems().layout();
}

function toggleSidebar() {
    sb = document.querySelector(".leftsidebar");
    if (sb.style.display == "none") {
        sb.style.display = "flex";
        sidebarGrid.refreshItems().layout();
        document.getElementById("sideBarButton").src = '/_static_/images/closemenuIcon.svg';
    } else {
        sb.style.display = "none";
        document.getElementById("sideBarButton").src = '/_static_/images/openmenuIcon.svg';
    }
}

function processJsonPage(json) {
    // Show any notifications
    notification(json);
    if (json.user) user = json.user;  // update any user state change, such as EP open/close

    // Fix the title
    if ((typeof json.title !== "undefined") && (json.title != "")) {
        document.title = json.title + " - " + SITE_NAME;
    } else document.title = SITE_NAME;


    let wc = document.querySelector('.wikicontent')
    // Our current page template isn't capable of showing wiki pages so reload the entire page
    if (wc == null) {
        window.location.href = json.canonicalURL;
        return;
    }

    // Patch up search results
    if (typeof json.searchResults !== "undefined") {
        let srBubble = document.getElementById("searchResults");
        let srContents = document.getElementById("searchI")
        if (Array.isArray(json.searchResults)) {
            if (json.searchResults.length == 0) srContents.innerHTML = "<center>nothing found</center>";
            else {
                let ih = "";
                json.searchResults.forEach(r => {
                    let tmp = r.ref;
                    if (tmp[0] != "/") tmp = "/" + tmp;  // because search results must always be absolute, since current page could be anywhere
                    ih = ih.concat(LinkToLinkify(tmp, "sch"));
                });
                srContents.innerHTML = ih;
            }
            sidebarGrid.show(srBubble);
            sidebarGrid.refreshItems().layout();
        } else { // Now search is always in sidebar
            if (json.searchResults.length == 0) srContents.innerHTML = "";
            sidebarGrid.show(srBubble);
            sidebarGrid.refreshItems().layout();
        }
    }

    /* Deal with any of a variety of ways to update the center page & related content */
    if (typeof json.wikiPage !== "undefined") {
        wc.innerHTML = json.wikiPage;
        updatePage(json);
        sidebarGrid.refreshItems().layout();
        if (json.anchor == null) {
            window.scrollTo({
                top: 0
            });
        } else {
            jumpTo(json.anchor);
        }
    } else if (typeof json.html !== "undefined") {
        wc.innerHTML = json.html;
        updatePage(json);
        sidebarGrid.refreshItems().layout();
        if (json.anchor == null) {
            window.scrollTo({
                top: 0
            });
        } else {
            jumpTo(json.anchor);
        }
    } else if (typeof json.rawMarkdown !== "undefined") {
        processFetchedMd(json.rawMarkdown).then(html => {
            updatePage(json);
            sidebarGrid.refreshItems().layout();
            if (json.anchor == null) {
                window.scrollTo({
                    top: 0
                });
            } else {
                jumpTo(json.anchor);
            }
        });
    }
}

function internalLinkOptimizer(doc, wnd, e) {
    //console.log("clicked on ", e);
    var loc = wnd.location;
    var tgt = e.target;
    // Don't intervene for links to media or downloadable files
    if (!isElement(tgt) && isMedia(tgt)) return true;
    if (isElement(tgt) && isMedia(tgt.href)) return true;

    if ((tgt.tagName == "A") || (tgt.tagName == "a")) {
        // console.log("its A", tgt.host, loc.host);
        if (tgt.host == loc.host) // I will handle this via JSON
        {
            e.preventDefault();
            e.stopPropagation();
            let r = fetchJsonFor(tgt.href);
        }
        return false;
    }
    return true;
}

function backOptimizer(doc, wnd, e) {
    if (e.state) {
        var json = e.state.json;
        if (json) {
            e.preventDefault();
            e.stopPropagation();
            processJsonPage(json);
            return false;
        } else {
            window.location.reload(false);
        }
    } else {
        window.location.reload(false);
    }

    return true;
}


function setupLayout(document, window) {
    document.addEventListener("click", e => internalLinkOptimizer(document, window, e));
    window.addEventListener("popstate", e => backOptimizer(document, window, e));
    // This one happens whenever the page is being shown, not when history changes
    // window.addEventListener("pageshow", e => backOptimizer(document, window,e));
}

// Prints out a warning or error in a prominent location.  Json is a dictionary object that may have a "notification" member

function clearNotification() {
    document.getElementById('notifyText').innerText = "";
    //document.querySelector('div.notification').visibility = "hidden";
    document.querySelector('div.notification').style.display = "none";
}

function notification(json) {
    if (json.notification) {
        document.getElementById('notifyText').innerText = json.notification;
        //document.querySelector('div.notification').visibility = "visible";
        document.querySelector('div.notification').style.display = "block";
        setTimeout(function() {
            if (document.getElementById('notifyText').innerText == json.notification) clearNotification();
        }, NOTIFICATION_DELAY);
    }
}

function openEditProposal() {
    let epEntry = document.getElementById("editProposal");
    fetch("/_editProposal_/open/" + epEntry.value).then(response => response.json().then(json => {
        if (json.error == 0) setEditProposalMenuVisibility(epEntry.value);
        let locNoArgs = window.location.pathname;
        fetch(locNoArgs + "?json=1").then(response => response.json().then(json => {
            processJsonPage(json);
        }));
        notification(json);
    }));
    return false;
}

function closeEditProposal() {
    let epEntry = document.getElementById("editProposal");
    // Commit any pending edits first
    fetch("/_commit_").then(r => r.json().then(j => {
        // Now close
        fetch("/_editProposal_/close").then(response => response.json().then(json => {
            if (json.error == 0) setEditProposalMenuVisibility("");
            let locNoArgs = window.location.pathname;
            fetch(locNoArgs + "?json=1").then(response => response.json().then(json => {
                processJsonPage(json);
            }));
            notification(json);
            epEntry.value = "";
        }));
    }));
    return false;
}

function submitEditProposal() {
    let epEntry = document.getElementById("editProposal");
    // Commit any pending edits first
    fetch("/_commit_").then(r => r.json().then(j => {
        // Now close
        fetch("/_editProposal_/submit").then(response => response.json().then(json => {
            if (json.error == 0) setEditProposalMenuVisibility("");
            let locNoArgs = window.location.pathname;
            fetch(locNoArgs + "?json=1").then(response => response.json().then(json => {
                processJsonPage(json);
            }));
            notification(json);
            epEntry.value = "";
        }));
    }));
}

function diffEditProposal() {
    let epEntry = document.getElementById("editProposal");

    fetch("/_editProposal_/diff").then(response => response.json().then(json => {
        processJsonPage(json);
        notification(json);
        epEntry.value = "";
    }));
}

function setEditProposalMenuVisibility(ep) {
    if (ep) {
        document.getElementById("closeEP").hidden = false;
        document.getElementById("submitEP").hidden = false;
        //document.getElementById("diffEP").hidden=false;
        document.getElementById("diffEP").hidden = true; // for now disable
        document.getElementById("diffEPsep").hidden = true; // for now disable
        document.getElementById("openEP").hidden = true;
    } else {
        document.getElementById("closeEP").hidden = true;
        document.getElementById("submitEP").hidden = true;
        document.getElementById("diffEP").hidden = true;
        document.getElementById("diffEPsep").hidden = true; // for now disable
        document.getElementById("openEP").hidden = false;
    }
}

function logout() {
    window.location.href = '/_logout_';
}


function search() {
    let searchIn = document.getElementById("searchText");
    let query = searchIn.value;
    hideKeyboard(searchIn);

    if (query == "") {
        if (lastSearch != "") {
            // Don't hide the search when there's nothing
            //sidebarGrid.hide(document.getElementById("searchResults"));
            // Just remove the search results
            let srContents = document.getElementById("searchI")
            srContents.innerHTML = "";
            sidebarGrid.refreshItems().layout();
        } else
            notification({
                notification: "enter search terms"
            });

        lastSearch = "";
        return;
    }

    lastSearch = query;
    //console.log("search: " + query);

    fetch("/_search_", {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, cors, *same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                'Content-Type': 'text/plain',
            },
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: query, // body data type must match "Content-Type" header
        })
        .then(response => response.json().then(reply => {
            // console.log(JSON.stringify(reply));
            showSidebar();
            processJsonPage(reply);
        }));

}


function runEditorIfPermitted(href, md) {
        if (!user.loggedIn) notification({notification:"log in first"});
        else {
        // Its ok to check this on the client side because if defeated the user will be able to open the editor but still not commit anything that's changed
        if (!user.perms.push && !user.editProposal && user.perms.propose) notification({notification:"open an edit proposal before editing"});
        else if (!user.perms.push && !user.perms.propose) notification({notification:"contact an administrator to gain edit permissions"});
        else
            runeditor(href, md);
        }
    }
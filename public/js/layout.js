var EPHEMERAL_SIDEBAR_SIZE = 600; // If the screen width is smaller than this, auto-hide the sidebar
var NOTIFICATION_DELAY = 15000;

var lastSearch = "";


// see: https://stackoverflow.com/questions/8335834/how-can-i-hide-the-android-keyboard-using-javascript
function hideKeyboard(element) {
    console.log(element);
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
    s = s.replace(":", "");
    console.log("jumpTo " + s);
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

    fetch(s + "?json=1").then(response => {
            console.log(response);
            return response.json();
        })
        .then(json => {
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

function loginPolling() {
    var intervalID = setInterval(function() {
        fetch("/_login_/check").then(response => {
            if (response.status == 200) {
                window.location.href = "/";
            }
            if (response.status != 401) clearInterval(intervalID);
        });
    }, 500);
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

    console.log(s + " => " + text);
    var ret = '<div class="l' + cls + '"' + ' onclick="linkTo(\'' + text + '\')"><span class="i' + cls + '">' + show + "</span></div>\n";
    return ret;
}


function updatePage(json) {
    if (typeof json.related !== "undefined") { // undefined means don't touch
        let relBubble = document.getElementById("related");
        if (Array.isArray(json.related) && (json.related.length > 0)) {
            console.log(json.related);
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
            console.log("EP: " + json.user.editProposal);
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
                    ih = ih.concat(LinkToLinkify(r.ref, "sch"));
                });
                srContents.innerHTML = ih;
            }
            sidebarGrid.show(srBubble);
            sidebarGrid.refreshItems().layout();
        } else {
            sidebarGrid.hide(srBubble);
            sidebarGrid.refreshItems().layout();
        }
    }

    /* Deal with any of a variety of ways to update the center page & related content */
    if (typeof json.wikiPage !== "undefined") {
        wc.innerHTML = json.wikiPage;
        updatePage(json);
        sidebarGrid.refreshItems().layout();
        window.scrollTo({
            top: 0
        });
    } else if (typeof json.html !== "undefined") {
        wc.innerHTML = json.html;
        updatePage(json);
        sidebarGrid.refreshItems().layout();
        window.scrollTo({
            top: 0
        });
    } else if (typeof json.rawMarkdown !== "undefined") {
        processFetchedMd(json.rawMarkdown).then(html => {
            updatePage(json);
            sidebarGrid.refreshItems().layout();
            window.scrollTo({
                top: 0
            });
        });
    }
}

function internalLinkOptimizer(doc, wnd, e) {
    //console.log("clicked on ", e);
    var loc = wnd.location;
    var tgt = e.target;
    if (tgt.tagName == "A") {
        //console.log("its A", tgt.host, loc.host);
        if (tgt.host == loc.host) // I will handle this via JSON
        {
            e.preventDefault();
            e.stopPropagation();
            let r = fetchJsonFor(tgt.href);
        }
    }
}

function backOptimizer(doc, wnd, e) {
    if (e.state) {
        var json = e.state.json;
        if (json) {
            e.preventDefault();
            e.stopPropagation();
            processJsonPage(json);
        } else {
            window.location.reload(false);
        }
    } else {
        window.location.reload(false);
    }

}


function setupLayout(document, window) {
    document.addEventListener("click", e => internalLinkOptimizer(document, window, e));
    window.addEventListener("popstate", e => backOptimizer(document, window, e));
    // This one happens whenever the page is being shown, not when history changes
    // window.addEventListener("pageshow", e => backOptimizer(document, window,e));
}

// Prints out a warning or error in a prominent location.  Json is a dictionary object that may have a "notification" member
function notification(json) {
    if (json.notification) {
        document.getElementById('notifyText').innerText = json.notification;
        //document.querySelector('div.notification').visibility = "visible";
        document.querySelector('div.notification').style.display = "block";
        setTimeout(function() {
            if (document.getElementById('notifyText').innerText == json.notification) notification({});
        }, NOTIFICATION_DELAY);
    } else {
        document.getElementById('notifyText').innerText = "";
        //document.querySelector('div.notification').visibility = "hidden";
        document.querySelector('div.notification').style.display = "none";
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
            console.log("got here");
            notification(json);
            epEntry.value = "";
        }));
    }));
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
            sidebarGrid.hide(document.getElementById("searchResults"));
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
            console.log(JSON.stringify(reply));
            showSidebar();
            processJsonPage(reply);
        }));

}

var LAYOUT_HEADER_PX = 30;


function jumpTo(spot) {
    var s = spot.toLowerCase().split(/\s+/).join("-");
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

    var s = spot.toLowerCase().split(/\s+/).join("__");
    console.log("linkTo " + s);

    fetch(s + "?json=1").then(response => response.json().then(json => {
        processJsonPage(json);
        window.history.pushState({
            "json": json,
            "pageTitle": json.thisPage
        }, "", json.thisPage);
        document.title = json.thisPage;
    }));
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

function updatePage(json) {
    document.getElementById("historyI").innerHTML = json.history;
    document.getElementById("structureI").innerHTML = json.structure;
    document.getElementById("relatedI").innerHTML = json.related;
    document.getElementById("pageTitle").innerHTML = json.title;

    // undefined means leave as is, "" means no edit proposal
    if (json.user.editProposal !== undefined)
    {
    let epInput = document.getElementById("editProposal");
    if (epInput)
    {
        console.log("EP: " + json.user.editProposal);
        epInput.value = json.user.editProposal;
    }
    }
}

function processJsonPage(json) {
    console.log("processJsonPage");
    if (typeof json.html !== "undefined") {
        document.querySelector('.wikicontent').innerHTML = json.html;
        updatePage(json);
        sidebarGrid.refreshItems().layout();
        window.scrollTo({
            top: 0
        });
        notification(json);
    } else {
        processFetchedMd(json.rawMarkdown).then(html => {
            updatePage(json);
            sidebarGrid.refreshItems().layout();
            window.scrollTo({
                top: 0
            });
            notification(json);
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
            fetch(tgt.href + "?json=1").then(response => response.json().then(json => {
                processJsonPage(json);
                window.history.pushState({
                    "json": json,
                    "pageTitle": tgt.href
                }, "", tgt.href);
                document.title = tgt.href;

            }));
        }
    }
}

function backOptimizer(doc, wnd, e) {
    console.log(wnd.history.state);
    console.log("BackOptimizer");
    console.log(e);
    if (e.state) {
        var json = e.state.json;
        console.log(json);
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

function notification(json) {
    console.log("Notification: " + json.notification);
    if (json.notification) {
        document.querySelector('center.notifyText').innerText = json.notification;
        document.querySelector('div.notification').visibility = "visible";
        setTimeout(function() {
            if (document.querySelector('center.notifyText').innerText == json.notification) notification({});
        }, 5000);
    } else {
        document.querySelector('center.notifyText').innerText = "";
        document.querySelector('div.notification').visibility = "hidden";
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
        document.getElementById("closeEP").hidden=false;
        document.getElementById("submitEP").hidden=false;
        //document.getElementById("diffEP").hidden=false;
        document.getElementById("diffEP").hidden=true;  // for now disable
        document.getElementById("openEP").hidden=true;
    }
    else {
        document.getElementById("closeEP").hidden=true;
        document.getElementById("submitEP").hidden=true;
        document.getElementById("diffEP").hidden=true;
        document.getElementById("openEP").hidden=false;
    }
}

function logout() {
    window.location.href = '/_logout_';
}

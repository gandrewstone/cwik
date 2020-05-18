var LAYOUT_HEADER_PX=30;


function jumpTo(spot) {
    var s = spot.toLowerCase().split(/\s+/).join("-");
    console.log("jumpTo " + s);
    var e = document.getElementById(s);
    if (e)
    {
        //e.scrollIntoView(true);
        //window.scrollBy(0,-30);

        const y = e.getBoundingClientRect().top + window.pageYOffset - LAYOUT_HEADER_PX;
        window.scrollTo({top: y, behavior: 'smooth'});
    }
    else
    {
        console.log("unknown spot " + s);
    }
}

function processJsonPage(json) {
  processFetchedMd(json.rawMarkdown).then(html => {
                document.getElementById("historyI").innerHTML = json.history;
                document.getElementById("structureI").innerHTML = json.structure;
                document.getElementById("relatedI").innerHTML = json.related;
                document.getElementById("pageTitle").innerHTML = json.title;
                sidebarGrid.refreshItems().layout();
                vertGrid.refreshItems().layout();
                outerGrid.refreshItems().layout();
                    window.scrollTo({top: 0 });
                    notification(json);
                });
}

function internalLinkOptimizer(doc, wnd, e) {
    //console.log("clicked on ", e);
    var loc = wnd.location;
    var tgt = e.target;
    if (tgt.tagName == "A") {
        //console.log("its A", tgt.host, loc.host);
        if (tgt.host == loc.host)  // I will handle this via JSON
        {
            e.preventDefault();
            e.stopPropagation();
            fetch(tgt.href+"?json=1").then(response => response.json().then(json => {
                processJsonPage(json);
                window.history.pushState({"json": json , "pageTitle":tgt.href},"", tgt.href);
                document.title = tgt.href;

            }));
        }
    }
}

function backOptimizer(doc, wnd, e) {
    console.log(wnd.history.state);
    console.log("BackOptimizer");
    console.log(e);
    if (e.state)
    {
        var json = e.state.json;
        console.log(json);
        if (json)
        {
            e.preventDefault();
            e.stopPropagation();
            processJsonPage(json);
        }
        else
        {
            window.location.reload(false);
        }
    }
    else
    {
        window.location.reload(false);
    }

}


function setupLayout(document, window) {
    document.addEventListener("click", e => internalLinkOptimizer(document, window,e));
    window.addEventListener("popstate", e => backOptimizer(document, window,e));
    // This one happens whenever the page is being shown, not when history changes
    // window.addEventListener("pageshow", e => backOptimizer(document, window,e));
}

function notification(json) {
    console.log("Notification: " + json.notification);
    if (json.notification) {
        document.querySelector('center.notifyText').innerText = json.notification;
        document.querySelector('div.notification').visibility = "visible";
    }
    else
        document.querySelector('center.notifyText').innerText = "";
        document.querySelector('div.notification').visibility = "hidden";
}

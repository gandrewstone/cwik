

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
                processFetchedMd(json.rawMarkdown);
                document.getElementById("historyI").innerHTML = json.history;
                document.getElementById("structureI").innerHTML = json.structure;
                document.getElementById("relatedI").innerHTML = json.related;
                document.getElementById("pageTitle").innerHTML = json.title;
                document.title = tgt.href;
                window.history.pushState({"md": json , "pageTitle":tgt.href},"", tgt.href);
                headerGrid.refreshItems().layout();
                sidebarGrid.refreshItems().layout();
                vertGrid.refreshItems().layout();
                outerGrid.refreshItems().layout();
            }));
        }
    }
}

function backOptimizer(doc, wnd, e) {
    //console.log(wnd.history.state);
    //console.log("BackOptimizer");
    //console.log(e);
    if (e.state)
    {
        var md = e.state["md"];
        if (md)
        {
            e.preventDefault();
            e.stopPropagation();
            processFetchedMd(md);
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

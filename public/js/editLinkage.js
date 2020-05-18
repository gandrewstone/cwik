/* Take a markdown file place it in the hidden textarea, and render it into html into the appropriate locations */
function processFetchedMd_old(text) {
    console.log("processing data 2");
    document.querySelector('textarea.cwikeditor').value = text;
    var se = new Stackedit({
        url: STACKEDITOR_URL
    });

    se.openFile({
        name: "",
        content: {
            text: text
        }
    }, true); // true == silent mode
    se.on('fileChange', (file) => {
        console.log("FILE CHANGE");
        document.querySelector('.wikicontent').innerHTML = file.content.html;
        // Give time for innerHTML to be rendered into DOM
        setTimeout(xformMermaids, 50);
        setTimeout(xformKatex, 50);
        setTimeout(xformMermaids, 200);
        setTimeout(xformKatex, 200);
        delete se;
    });
}


var sedit = new Stackedit({
    url: STACKEDITOR_URL
});


function processFetchedMd(text) {
    return new Promise(function(resolve, reject) {
        console.log("processing data");
        document.querySelector('textarea.cwikeditor').value = text;

        // var seEditor = document.getElementsByClassName('stackedit-hidden-container')[0];
        if (true) // typeof seEditor === "undefined")
        {
            console.log("open file");

            sedit.openFile({
                name: "",
                content: {
                    text: text
                }
            }, true); // true == silent mode
        } else {
            var iframe = seEditor.getElementsByClassName('stackedit-iframe')[0];
            var element = iframe.contentWindow.document.getElementsByClassName("hidden-rendering-container")[0];
            console.log("reuse");
            console.log(seEditor);
            element.innerHTML = text;
        }
        console.log("render");

        var hdlr = function(file) {
            console.log("render complete");
            document.querySelector('.wikicontent').innerHTML = file.content.html;
            // Give time for innerHTML to be rendered into DOM
            setTimeout(xformMermaids, 50);
            setTimeout(xformKatex, 50);
            setTimeout(xformMermaids, 200);
            setTimeout(xformKatex, 200);
            resolve(file.content.html);
            console.log(JSON.stringify(sedit));
            sedit.off('fileChange', hdlr);
        }

        sedit.on('fileChange', hdlr);
    });
}


/* transform katex-style markup into html math */
function xformKatex() {
    var katexes = document.getElementsByClassName('katex--inline');
    var i = 0;
    for (i = 0; i < katexes.length; i++) {
        var text = katexes[i].firstChild.data;
        katex.render(text, katexes[i], {
            throwOnError: false
        });
    }

    katexes = document.getElementsByClassName('katex--display');
    var i = 0;
    for (i = 0; i < katexes.length; i++) {
        var text = katexes[i].firstChild.data;
        katex.render(text, katexes[i], {
            throwOnError: false
        });
    }
}

/* transform mermaid-style markup into html */
/* Once the parent node is touched, it rerenders other nodes, detaching all the other elements in mermaids from the DOM. So we need to do them one at a time, re-discovering each element after every change.
 */
var mermaidCount = 0; // Uniquify each newly created svg tag
function xformMermaids() {
    var mermaids = document.getElementsByClassName('prism language-mermaid');
    if (mermaids.length == 0) return;
    var i = 0;
    // skip anything that's already been rendered.
    for (i = 0;
        (i < mermaids.length) && (mermaids[i].getAttribute("rendered") != null); i++);
    if (i == mermaids.length) return;

    var mm = mermaids[i];
    mm.setAttribute("rendered", true);
    var text = mm.firstChild.data;
    // console.log(text);
    mermaid.render('mer' + mermaidCount, text, function(svgGraph) {
        mm.parentNode.outerHTML = "<div>" + svgGraph + "</div>";
    });

    mermaidCount += 1;
    xformMermaids();
}


function logout() {
    fetch("/_logout_").then(function(data) {
        window.location.reload(false);
    });
}

function login() {
    window.location.href = "/_login_";
}

function commitEdits() {
    fetch("/_commit_").then(response => response.json().then(notification));
}


function uploadEdit(url, text) {
    console.log("upload Edit to: " + url);
    fetch(url, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, cors, *same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, *same-origin, omit
            headers: {
                'Content-Type': 'text/plain',
            },
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: text, // body data type must match "Content-Type" header
        })
        .then(response => response.json().then(notification)); // parses JSON response into native JavaScript objects 
}

function runeditor(url, domElem) {
    console.log(url);
    // Open the iframe
    var stackedit = new Stackedit({
        url: STACKEDITOR_URL
    });

    stackedit.openFile({
        name: 'Filename', // with an optional filename
        content: {
            text: domElem.value // and the Markdown content.
        }
    });

    var html = "";

    // Listen to StackEdit events and apply the changes to the textarea.
    stackedit.on('fileChange', (file) => {
        domElem.value = file.content.text;
        html = file.content.html;
    });

    stackedit.on('close', (file) => {
        document.querySelector(".wikicontent").innerHTML = html;
        setTimeout(xformMermaids, 100);
        setTimeout(xformKatex, 100);
        // console.log(domElem.value);
        uploadEdit(url, domElem.value);
    });

    return false;
}

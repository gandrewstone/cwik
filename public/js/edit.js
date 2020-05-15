const stackedit = new Stackedit({
    url: STACKEDITOR_URL
});

/* Take a markdown file place it in the hidden textarea, and render it into html into the appropriate locations */
function processFetchedMd(text) {
    console.log("processing data");
    document.querySelector('textarea.cwikeditor').value = text;
    stackedit.openFile({
        name: "",
        content: {
            text: text
        }
    }, true); // true == silent mode
    stackedit.on('fileChange', (file) => {
        console.log("FILE CHANGE");
        document.querySelector('.wikicontent').innerHTML = file.content.html;
        // Give time for innerHTML to be rendered into DOM
        setTimeout(xformMermaids, 50);
        setTimeout(xformKatex, 50);
        setTimeout(xformMermaids, 200);
        setTimeout(xformKatex, 200);
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

function notification(json) {
    console.log(JSON.stringify(json));
    console.log(json.notification);
    if (json.notification) {
        document.querySelector('center.notifyText').innerText = json.notification;
    }
}

function uploadEdit(url, text) {
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
    // Open the iframe
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
        console.log(domElem.value);
        uploadEdit(url, domElem.value);
    });

    return false;
}
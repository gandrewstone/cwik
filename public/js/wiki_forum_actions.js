function quoteandcreate()
{
    var document_name = String(window.location);
    var strArray = document_name.split("/");
    document_name = strArray[strArray.length - 1];
    document_name = document_name + ".md";
    var redirectForm = document.createElement("form");
    redirectForm.type = "hidden";
    redirectForm.method = "post";
    redirectForm.action = "/forum/_new_thread_quoted";
    redirectForm.innerHTML = '<input name="quoted_filename" value=' + document_name + '>';
    document.body.append(redirectForm);
    redirectForm.submit();
}


//function openInEditor(url, domElem) {
function openInEditor(domElem) {
    console.log("here")
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
        // document.querySelector("thread_body").value = html;
        domElem.value = html;
        setTimeout(xformMermaids, 100);
        setTimeout(xformKatex, 100);
        console.log(domElem.value);
        // uploadEdit(url, domElem.value);
     });

    return false;
}

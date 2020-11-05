// Significantly pulled from: https://www.smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/

let dropArea = document.getElementById('dropArea')

;
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, preventDefaults, false)
})

function preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
}

;
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false)
})

;
['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false)
})

document.addEventListener('drop', handleMissedDrop, false);


dropArea.addEventListener('drop', handleDrop, false);

function highlight(e) {
    dropArea.classList.add('highlight')
}

function unhighlight(e) {
    dropArea.classList.remove('highlight')
}

function handleMissedDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    notification({
        notification: "BUOD Error?  You missed the box!  Let me help you out..."
    });
    let b = document.getElementById("dropArea");
    setTimeout(() => {
        b.style.width = "800px";
        b.style.height = "600px";
    }, 1000);
}


function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    let dt = e.dataTransfer
    let files = dt.files

    handleFiles(files)
}

function handleFiles(files) {
    for (let i = 0; i < files.length; i++)
        uploadFile(files[i]);
}

function uploadFile(file) {
    let path = location.pathname;
    let url = '/_upload_' + location.pathname;
    let formData = new FormData();
    formData.append('file', file);
    console.log("upload to: " + url);
    fetch(url, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(json => {
            console.log(json);
            processJsonPage(json);
            setTimeout(() => {
                document.location.href = path + "?upload=1";
            }, 500);

        })
        .catch((err) => {
            notification({
                notification: err
            })
        });
}
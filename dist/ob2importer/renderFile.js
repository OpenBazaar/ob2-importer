
function importFromOB1(event) {
    event.preventDefault() // stop the form from submitting
    var csvfile = document.getElementById("csv-file").files[0].path;
    var ip = document.getElementById("ob2-ip-address").value;
    var port = document.getElementById("ob2-port").value;
    var authCookie = document.getElementById("ob2-authcookie").value;    

    ipcRenderer.send('import-from-ob1-submission', csvfile, ip, port, authCookie);
}


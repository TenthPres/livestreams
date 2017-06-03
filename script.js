// load the knockout library & separate css file
var knockoutLib = document.createElement('script'),
    head  = document.getElementsByTagName('head')[0],
    stylesht = document.createElement('link');

knockoutLib.src = 'node_modules/knockout/build/output/knockout-latest.js';
knockoutLib.type = 'text/javascript';
knockoutLib.onload = initalizeModels;
head.appendChild(knockoutLib);

stylesht.rel  = 'stylesheet';
stylesht.type = 'text/css';
stylesht.href = 'style.min.css';
head.appendChild(stylesht);

var scripts = document.getElementsByTagName('script'),
    container = scripts[scripts.length-1].parentNode,
    mediaElt = document.createElement('p'),
    div = document.createElement('div'),
    progList = document.createElement('div'),
    vm = {};


// impose some styling on the container.
container.style.width = "100%";
container.style.paddingBottom = "56.25%";
container.style.marginBottom = "4em"; // space for progList
container.style.position = "relative";
container.style.font = "inherit";
container.style.fontFamily = "\"Whitney SSm A\", \"Whitney SSm B\", \"Open Sans\", sans-serif";
container.style.borderRadius = 0;

// place div for later.
div.style.width = "100%";
div.style.height = "100%";
div.style.position = "absolute";
div.style.left = 0;
div.style.right = 0;
div.style.border = 0;
div.style.display = "none";
container.appendChild(div);

// place progList for later.
progList.id = "progList";
progList.setAttribute("data-bind", "foreach: vm.livePrograms");
progList.innerHTML = "<div data-bind=\"foreach: sources, visible: sources.length > 1 \"><a data-bind=\"attr: {title: providerName(type), class: type, id: id }, css: { 'active': vm.currentMode() === id }, click: playSource \"></a></div>";
container.appendChild(progList);

// insert "loading" into container.
mediaElt.style.width = "100%";
mediaElt.style.top = "45%";
mediaElt.style.position = "absolute";
mediaElt.innerHTML = "loading...";
mediaElt.style.backgroundColor = "#eee";
container.appendChild(mediaElt);

function providerName(type) {
    switch (type) {
        case "yt":
            return "YouTube Video";
        case "sa-vid":
            return "SermonAudio Video";
        case "sa-aud":
            return "Audio only";
    }
}

function initalizeModels() {

    vm.livePrograms = ko.observableArray([]);
    vm.currentMode = ko.observable("loading");

    ko.applyBindings(vm, container);

    doRequest();
    setInterval(doRequest, 5000);
}

// listener for response from server
function liveStreamJsonListener() {
    // receive response.
    var response = JSON.parse(this.responseText);

    vm.livePrograms(response.live);

    if (vm.currentMode() == "loading") {
        if (response.live.length > 0) {
            playSource(response.live[0].sources[0]);
        } else {
            mediaElt.innerHTML = "There is no livestream currently available.<br />We will display the livestream here as soon as it begins."
        }
    }

}

function doRequest() {
    var req = new XMLHttpRequest();
    req.addEventListener('load', liveStreamJsonListener);
    req.open("GET", "json?current=" + vm.currentMode());
    // req.open("GET", "json/test.json?current=" + vm.currentMode());
    req.send();
}


function playSource(source) {
    clearVideoWindow();
    vm.currentMode(source.id);
    switch (source.type) {
        case "yt":
            playYouTube(source);
            return;
        case "sa-vid":
            playSaVid(source);
            return;
        case "sa-aud":
            playSaAud(source);
            return;
    }
}


function playYouTube(source) {
    mediaElt.src = source.url;
}

function playSaVid(source) {
    mediaElt.src = source.url;
}

function playSaAud(source) {
    mediaElt.src = source.url;
}


function clearVideoWindow() {
    //place mediaElt for later
    container.removeChild(mediaElt);
    mediaElt = document.createElement('iframe');
    mediaElt.style.width = "100%";
    mediaElt.style.height = "100%";
    mediaElt.style.position = "absolute";
    mediaElt.style.left = 0;
    mediaElt.style.right = 0;
    mediaElt.style.border = 0;
    mediaElt.setAttribute('allowFullScreen','');
    container.appendChild(mediaElt);
}



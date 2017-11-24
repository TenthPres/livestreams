// load the knockout library & separate css file
var knockoutLib = document.createElement('script'),
    head  = document.getElementsByTagName('head')[0],
    stylesht = document.createElement('link'),
    container = document.scripts[document.scripts.length-1].parentNode,
    scriptBase = document.scripts[document.scripts.length-1].src.replace(/(\/\/.*?\/.*\/).*/g, '$1'),
    mediaElt = document.createElement('p'),
    progList = document.createElement('div'),
    vm = {},
    isTestingMode = (!(getUrlParameter('test') !== null)) + 2 * (!(getUrlParameter('static') !== null));

knockoutLib.src = scriptBase + 'node_modules/knockout/build/output/knockout-latest.js';
knockoutLib.type = 'text/javascript';
knockoutLib.onload = initalizeModels;
head.appendChild(knockoutLib);

stylesht.rel  = 'stylesheet';
stylesht.type = 'text/css';
stylesht.href = scriptBase + 'style.min.css';
head.appendChild(stylesht);

// place progList for later.
progList.id = "progList";
progList.setAttribute("data-bind", "foreach: vm.livePrograms");
progList.setAttribute("oncontextmenu","return false;");
progList.innerHTML = "<div data-bind=\"foreach: sources \"><a data-bind=\"attr: {title: providerName($data), class: type, id: id }, css: { 'active': vm.currentMode() === id }, click: playSource \"></a></div>";
container.appendChild(progList);

// insert "loading" into container.
mediaElt.innerHTML = "loading...";
container.appendChild(mediaElt);

function providerName(data) {
    var s = "";

    switch (data.type) {
        case "yt":
            s += "YouTube Video";
            break;

        case "fbl":
            s += "Facebook Live";
            break;

        case "sa-vid":
            s += "SermonAudio Video";
            break;

        case "sa-aud":
            s += "Audio only";
            break;
    }

    if (vm.currentMode() === data.id)
        s += "\nNow Playing";

    return s;
}

function initalizeModels() {

    vm.livePrograms = ko.observableArray([]);
    vm.archive = ko.observableArray([]);
    vm.messages = ko.observableArray([]);
    vm.currentMode = ko.observable("loading");

    ko.applyBindings(vm, document.body);

    doRequest();
    setInterval(doRequest, 5000);
}

// listener for response from server
function liveStreamJsonListener() {
    // receive response.
    var response = JSON.parse(this.responseText);

    if (JSON.stringify(vm.livePrograms()) !== JSON.stringify(response.live)) { // update vm streams if there's a change
        vm.livePrograms(response.live);
    }

    if (JSON.stringify(vm.archive()) !== JSON.stringify(response.archive)) { // update vm archive if there's a change
        vm.archive(response.archive);
    }

    if (!sourceIsValid(vm.currentMode())) { // if the client is watching a source that's no longer valid.
        clearVideoWindow();
        vm.currentMode("loading");
    }

    if (vm.currentMode() === "loading") { // if the client is in "loading" mode
        if (response.live.length > 0) {
            if (response.live[0].sources.length > 0) {
                playSource(response.live[0].sources[0]);
            } else {
                mediaElt.innerHTML = "A livestream is currently available, but is not compatible with your browser.<br />Please consider using a different browser."
            }
        } else {
            mediaElt.innerHTML = "There is no livestream currently available.<br />We will display the livestream here as soon as it begins."
        }
    }

    if (JSON.stringify(vm.messages()) !== JSON.stringify(response.msg)) { // update vm messages if there's a change
        vm.messages(response.msg);
        document.body.getElementsByClassName('video_messages')[0].innerHTML = vm.messages().join('<br /><br />');
    }
}

function switchTabs_streamsList(caller) {
    switchTabs_reset(caller);
    document.getElementsByClassName('sidebar')[0].style.display = 'block';
}

function switchTabs_reset(caller) {
    // hide other content sections.
    document.getElementsByClassName('sidebar')[0].style.display = '';
    var sects = document.getElementsByClassName('section-content');
    for(var si in sects) {
        if (!sects.hasOwnProperty(si))
            continue;
        sects[si].style.display = 'none';
    }

    // remove 'active' class from tab
    var tabs = caller.parentNode.parentNode.children;
    for(var ti in tabs) {
        if (!tabs.hasOwnProperty(ti))
            continue;
        tabs[ti].classList.remove('active');
    }

    // add 'active' class to caller tab
    caller.parentNode.classList.add('active');

}

function doRequest() {
    var req = new XMLHttpRequest();
    req.Timeout = 3800;
    req.withCredentials = true;
    req.addEventListener('load', liveStreamJsonListener);
    req.addEventListener('timeout', liveStreamJsonTimeout);
    // req.open("GET", scriptBase + "json/test.json");
    req.open("GET", scriptBase + "json/?current=" + vm.currentMode() + (isTestingMode ? '&test='+isTestingMode : ''));
    req.send();
}

function liveStreamJsonTimeout() {
    window.console.info('XHR Timeout');
}

function sourceIsValid(sourceId) {
    if (sourceId === 'loading') // 'loading' is always a valid source because of the possibility that it could be paused.
        return true;

    if (sourceId.indexOf('yt-') === 0) // youtube is always a valid source (at least, for now).
        return true;

    // for everything else, if it's in the list of current sources, it's valid.  If it's not, it's not.
    return undefined !== vm.livePrograms().find(function (prg) {
        return undefined !== prg.sources.find(function(src) {
            return(src.id === this.id);
        }, this);
    }, {"id":sourceId});
}

function playSource(source) {
    createVideoFrame();
    vm.currentMode(source.id);
    switch (source.type) {
        case "yt":
            playYouTube(source);
            return;

        case "fbl":
            playFacebook(source);
            return;

        case "sa-vid":
            playSaVid(source);
            return;

        case "sa-aud":
            playSaAud(source);
            return;
    }
}

function playVerb(source) {
    switch (source.type) {
        case "yt":
        case "fbl":
        case "sa-vid":
            return "Watch";

        case "sa-aud":
            return "Listen";
    }
}


function playYouTube(source) {
    mediaElt.src = source.url;
}

function playFacebook(source) {
    mediaElt.src = source.url;
}

function playSaVid(source) {
    mediaElt.src = source.url;
}

function playSaAud(source) {
    mediaElt.src = source.url;
}


function clearVideoWindow() {
    container.removeChild(mediaElt);
    mediaElt = document.createElement('p');
    container.appendChild(mediaElt);
}

function createVideoFrame() {
    container.removeChild(mediaElt);
    mediaElt = document.createElement('iframe');
    mediaElt.classList.add("video_mediaElt");
    mediaElt.setAttribute('allowFullScreen','');
    mediaElt.setAttribute('scrolling','no');
    container.appendChild(mediaElt);
}

function getUrlParameter(name) { // shoutout to https://stackoverflow.com/a/11582513/2339939
    var uri = (new RegExp('[?&]' + name + '(?:=([^&;]+))?').exec(location.search) || ['&', '&'])[1];
    uri = (uri || null);
    if (uri === '&')
        return undefined;
    if (uri === null)
        return uri;
    return decodeURIComponent(uri.replace(/\+/g, '%20'));
}

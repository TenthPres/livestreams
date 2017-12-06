/**
 * @summary Script for embedding live videos from various streaming providers into Tenth.org
 *
 * @author James Kurtz
 * @copyright 2017
 * @licence See https://github.com/TenthPres/livestreams for terms
 */

/** Create new HTML elements & define variables */
var knockoutLib = document.createElement('script'),
    head  = document.getElementsByTagName('head')[0],
    stylesht = document.createElement('link'),
    container = document.scripts[document.scripts.length-1].parentNode,
    scriptBase = document.scripts[document.scripts.length-1].src.replace(/(\/\/.*?\/.*\/).*/g, '$1'),
    mediaElt = document.createElement('p'),
    progList = document.createElement('div'),
    vm = {},
    isTestingMode = (!(getUrlParameter('test') !== null)) + 2 * (!(getUrlParameter('static') !== null));

/** Load Knockout */
knockoutLib.src = scriptBase + 'node_modules/knockout/build/output/knockout-latest.js';
knockoutLib.type = 'text/javascript';
knockoutLib.onload = initalizeModels;
head.appendChild(knockoutLib);

/** Load additional custom CSS */ // Ideally, this would probably be integrated into the css templating already present.
stylesht.rel  = 'stylesheet';
stylesht.type = 'text/css';
stylesht.href = scriptBase + 'style.min.css';
head.appendChild(stylesht);

/** Create and place the "Program List" which appears under the video player */
progList.id = "progList";
progList.setAttribute("data-bind", "foreach: vm.livePrograms");
progList.setAttribute("oncontextmenu","return false;");
progList.innerHTML = "<div data-bind=\"foreach: sources \"><a data-bind=\"attr: {title: providerName($data), class: type, id: id }, css: { 'active': vm.currentMode() === id }, click: playSource \"></a></div>";
container.appendChild(progList);

/** Insert "Loading..." into the video container. */
mediaElt.innerHTML = "loading...";
container.appendChild(mediaElt);

/**
 * @function Helps clarify provider for a given stream in the UI.  This is called by knockout bindings.
 * @param source    {object}    A source object from within a LiveEvent object.  These are defined by the JSON from the
 *                              server, and are stored in vm.livePrograms
 * @returns         {string}    A string useful for distinguishing between streams.
 */
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

/**
 * @function Initialize the observables in the view model with Knockout.
 */
function initalizeModels() {

    vm.livePrograms = ko.observableArray([]);
    vm.archive = ko.observableArray([]);
    vm.messages = ko.observableArray([]);
    vm.currentProgram = ko.observable("loading");
    vm.currentMode = ko.observable("loading");
    vm.currentAttachment = ko.observable(null);

    ko.applyBindings(vm, document.body);

    doRequest();
    setInterval(doRequest, 5000);
}

/**
 * @function Listener for Live XHR Response
 */
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
        vm.currentProgram("loading");
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
    
    /* Handle messages */
    // TODO figure out a method for hashing messages so they don't all need to be sent every time.
    // TODO apply that hashing mechanism to descriptions, too.
    if (JSON.stringify(vm.messages()) !== JSON.stringify(response.msg)) { // updates only if there's a change.  (Helps avoid needless UI refresh)
        vm.messages(response.msg);
        document.body.getElementsByClassName('video_messages')[0].innerHTML = vm.messages().join('<br /><br />');
    }
}


function selectAttachment(attachment) {
    switchTabs_reset(attachment);
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

/**
 * @function Create and send the Live XHR Request
 */
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

/**
 * @function Handler for when the XHR times out.  TODO figure out a good way for reporting this back to some analytics mechanism.
 */
function liveStreamJsonTimeout() {
    window.console.info('XHR Timeout');
}

/**
 * @function Determines if a source with a given ID is currently valid for display.  Most useful for after a live events ends.
 * @param {string} sourceId  The source ID, probably provided by the server at some point.
 * @returns {boolean}  True of the source is valid for display.
 */
function sourceIsValid(sourceId) {
    if (sourceId === 'loading') // 'loading' is always a valid source because of the possibility that it could be paused.
        return true;

    if (sourceId.indexOf('yt-') === 0) // youtube is always a valid source (at least, for now).
        return true;

    // for everything else, if it's in the list of current sources, it's valid.  If it's not, it's not.
    return undefined !== _getProgramFromSourceId(sourceId);
}

function _getProgramFromSourceId(sourceId) {
    return vm.livePrograms().find(function (prg) {
        return undefined !== prg.sources.find(function(src) {
            return(src.id === this.id);
        }, this);
    }, {"id":sourceId});
}

/**
 * @function Starts playing a given source.
 * @param source {object} A source object from within a LiveEvent object.
 */
function playSource(source) {
    createMediaFrame();
    vm.currentMode(source.id);
    switch (source.type) {
        case "yt":
            playYouTube(source);
            return;

        case "fbl":
        case "sa-vid":
        case "sa-aud":
            playIFrame(source);
            return;
    }
}

/**
 * @function Provides the verb to use to describe the primary interaction with each stream.
 * @param source {object} A source object from within a LiveEvent object.
 * @returns {string} The pertinent verb
 */
function playVerb(source) {
    switch (source.type) {
        case "yt":
        case "fbl":
        case "sa-vid":
            return "Watch";

        case "sa-aud":
            return "Listen";
    }
    return "Join" // seems to be the most generic term that would apply, even if watch/listen don't.
}

/**
 * @function Play a YouTube source.
 * @param source {object} A source object from within a LiveEvent object.
 */
function playYouTube(source) {
    mediaElt.src = source.url;
    // TODO invoke YT JS API to determine if user interacts while this video is presented.
}

/**
 * @function Play a video within an iFrame with no vendor-specific arrangements.
 * @param source {object} A source object from within a LiveEvent object.
 */
function playIFrame(source) {
    mediaElt.src = source.url;
}

/**
 * @function Clear the mediaElement and replace with a space for text.
 */
function clearVideoWindow() {
    container.removeChild(mediaElt);
    mediaElt = document.createElement('p');
    container.appendChild(mediaElt);
}

/**
 * @function Clear the mediaElement and replace with an iFrame for inserting video into.
 */
function createVideoFrame() {
    container.removeChild(mediaElt);
    mediaElt = document.createElement('iframe');
    mediaElt.classList.add("video_mediaElt");
    mediaElt.setAttribute('allowFullScreen','');
    mediaElt.setAttribute('scrolling','no');
    container.appendChild(mediaElt);
}

/**
 * @function Extract a URL Parameter from the request bar.
 * @param name {string}  The name of the parameter for which the value is sought.
 * @returns {string|undefined}  The value of the specified parameter.
 *
 * @link Taken from https://stackoverflow.com/a/11582513/2339939
 */
function getUrlParameter(name) {
    var uri = (new RegExp('[?&]' + name + '(?:=([^&;]+))?').exec(location.search) || ['&', '&'])[1];
    uri = (uri || null);
    if (uri === '&')
        return undefined;
    if (uri === null)
        return uri;
    return decodeURIComponent(uri.replace(/\+/g, '%20'));
}

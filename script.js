/**
 * @summary Script for embedding live videos from various streaming providers into Tenth.org
 *
 * @author James Kurtz
 * @copyright 2017
 * @licence See https://github.com/TenthPres/livestreams for terms
 */

var container = document.scripts[document.scripts.length-1].parentNode,
    head  = document.getElementsByTagName('head')[0],
    vm = {interval: null},
    scriptBase = document.scripts[document.scripts.length - 1].src.replace(/(\/\/.*?\/.*\/).*/g, '$1'),
    isTestingMode = (!(getUrlParameter('test') !== null)) + 2 * (!(getUrlParameter('static') !== null));

if (container === head) {
    /* Status-only mode */

    // doRequest();
    if (vm.interval !== null)
        clearInterval(vm.interval);
    vm.interval = setInterval(doRequest, 30000);

} else {
    /* Video Player mode */

    /** Create new HTML elements & define variables */
    var knockoutLib = document.createElement('script'),
        stylesht = document.createElement('link'),
        mediaElt = document.createElement('p'),
        progList = document.createElement('div');

    /** Load Knockout */
    knockoutLib.src = scriptBase + 'node_modules/knockout/build/output/knockout-latest.js';
    knockoutLib.type = 'text/javascript';
    knockoutLib.onload = initalizeModels;
    head.appendChild(knockoutLib);

    /** Load additional custom CSS */ // Ideally, this would probably be integrated into the css templating already present.
    stylesht.rel = 'stylesheet';
    stylesht.type = 'text/css';
    stylesht.href = scriptBase + 'style.min.css';
    head.appendChild(stylesht);

    /** Create and place the "Program List" which appears under the video player */
    progList.id = "progList";
    progList.setAttribute("data-bind", "foreach: vm.livePrograms");
    progList.setAttribute("oncontextmenu", "return false;");
    progList.innerHTML = "<div data-bind=\"foreach: sources \"><a data-bind=\"attr: {title: providerName($data), class: type, id: id }, css: { 'active': vm.currentMode() === id }, click: playSource \"></a></div>";
    container.appendChild(progList);

    /** Insert "Loading..." into the video container. */
    mediaElt.innerHTML = "loading...";
    container.appendChild(mediaElt);
}

// noinspection JSUnusedGlobalSymbols
/**
 * Helps clarify provider for a given stream in the UI.  This is called by knockout bindings.
 *
 * @function
 * @param source    {object}    A source object from within a LiveEvent object.  These are defined by the JSON from the
 *                              server, and are stored in vm.livePrograms
 * @returns         {string}    A string useful for distinguishing between streams.
 */
function providerName(source) {
    var s = "";

    switch (source.type) {
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

    if (vm.currentMode() === source.id)
        s += "\nNow Playing";

    return s;
}

/**
 * Initialize the observables in the view model with Knockout.
 *
 * @function
 */
function initalizeModels() {

    vm.livePrograms = ko.observableArray([]);
    vm.archive = ko.observableArray([]);
    vm.messages = ko.observableArray([]);
    vm.currentProgram = ko.observable({attachments:[]});
    vm.currentMode = ko.observable("loading");
    vm.currentAttachment = ko.observable(null);

    ko.applyBindings(vm, document.body);

    doRequest();
    if (vm.interval !== null)
        clearInterval(vm.interval);
    vm.interval = setInterval(doRequest, 5000);
}

/**
 * Listener for Live XHR Response
 *
 * @function
 */
function liveStreamJsonListener() {

    // receive response.
    var response = JSON.parse(this.responseText),
        livestreamActiveBodyClassName = "livestreamActive";

    // update status class
    if (document.body.classList.contains(livestreamActiveBodyClassName) && response.live.length <= 0)
        document.body.classList.remove(livestreamActiveBodyClassName);
    if (!document.body.classList.contains(livestreamActiveBodyClassName) && response.live.length > 0)
        document.body.classList.add(livestreamActiveBodyClassName);

    // if we only care about status, then stop here.
    if (container === head)
        return;

    if (typeof vm.livePrograms !== "function" || JSON.stringify(vm.livePrograms()) !== JSON.stringify(response.live)) { // update vm streams if there's a change
        vm.livePrograms(response.live);
    }

    if (JSON.stringify(vm.archive()) !== JSON.stringify(response.archive)) { // update vm archive if there's a change
        vm.archive(response.archive);
    }

    if (!sourceIsValid(vm.currentMode())) { // if the client is watching a source that's no longer valid.
        clearMediaWindow();
        vm.currentMode("loading");
        vm.currentProgram({attachments:[]});
    }

    if (vm.currentMode() === "loading") { // if the client is in "loading" mode
        var ev = parseInt(getUrlParameter("event")),
            evObj = undefined;
        if (getUrlParameter("event") > 0) {
            evObj = vm.livePrograms().find(function(evO) {
                return evO.id === ev;
            });
            if (evObj === undefined) {
                evObj = vm.archive().find(function(evO) {
                    return evO.id === ev;
                });
            }
            if (evObj !== undefined) {
                if (evObj.sources.length > 0) {
                    playSource(evObj.sources[0]);
                }
            } else {
                mediaElt.innerHTML = "The livestream you're looking for isn't currently available.";
                if (response.live.length > 0) {
                    mediaElt.innerHTML += "<br />However, others are live now."
                }
            }
        } else {
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
    }
    
    /* Handle messages */
    // TODO figure out a method for hashing messages so they don't all need to be sent every time.
    // TODO apply that hashing mechanism to descriptions, too.
    if (JSON.stringify(vm.messages()) !== JSON.stringify(response.msg)) { // updates only if there's a change.  (Helps avoid needless UI refresh)
        vm.messages(response.msg);
        document.body.getElementsByClassName('video_messages')[0].innerHTML = vm.messages().join('<br /><br />');
    }
}

// noinspection JSUnusedGlobalSymbols
/**
 * For UI iterations that allow attachments (scripture, order of worship, etc.) to be shown to the user.
 *
 * @param attachment {object} The attachment object, originating with the json response.
 * @param event {event} Optional. The event (probably click) by which the attachment has been selected.
 */
function selectAttachment(attachment, event) {
    if (event !== undefined)
        switchTabs_reset(event.target);
    else
        switchTabs_reset();
    if (!attachment.hasOwnProperty('contentBox')) {
        attachment.contentBox = document.createElement('div');
        attachment.contentBox.classList.add('attachment');
        document.getElementsByClassName('attachmentContentSection')[0].appendChild(attachment.contentBox);
        if (attachment.name.substr(0, 3) === "TH ") { // Hymnal
            attachment.type = "Hymn";
            populateAttachment_TH(attachment);
        } else if (attachment.hasOwnProperty("ifrUrl")) {
            attachment.type = "Document";
            populateAttachment_ifr(attachment);
        } else {
            attachment.type = "Scripture";
            populateAttachment_ESV(attachment);
        }
    }
    vm.currentAttachment(attachment);
    attachment.contentBox.style.display = "";
    if (typeof ga === 'function') { // assume Google Analytics is loaded.
        ga('send', 'event', { 'eventCategory': 'Livestream', 'eventAction': 'Attachment: ' + attachment.type, 'eventLabel': attachment.name });
    }
}


function populateAttachment_TH(attachment) {
    attachment.contentBox.innerHTML = "<p>loading...</p>";
    var hymnNumber = attachment.name.substr(3),
        xhr = new XMLHttpRequest();
    xhr.open('GET', scriptBase + 'attachments/TH/?h=' + hymnNumber);
    xhr.addEventListener('load', function() {
        if (this.responseText === '') {
            attachment.contentBox.innerHTML = "<p>Due to copyright constraints, we cannot provide the music for this hymn online.</p>"
        } else {
            attachment.contentBox.innerHTML = this.responseText;
        }
    });
    xhr.send();
}


function populateAttachment_ESV(attachment) {
    attachment.contentBox.innerHTML = "<p>loading...</p>";
    var passage = attachment.name.split(':',2)[0],
        xhr = new XMLHttpRequest();
    xhr.open('GET', scriptBase + 'attachments/ESV/?q=' + passage);
    xhr.addEventListener('load', function() {
        if (this.responseText === '') {
            attachment.contentBox.innerHTML = "<p>Hmmm... couldn't load the passage.  Sorry about that.</p>"
        } else {
            attachment.contentBox.innerHTML = this.responseText;
        }
    });
    xhr.send();
}


function populateAttachment_ifr(attachment) {
    if (attachment.hasOwnProperty('ifrUrl')) {
        var ifr = document.createElement('iframe');
        ifr.src = attachment.ifrUrl;
        attachment.contentBox.appendChild(ifr);
    } else {
        attachment.contentBox.innerHTML = "Can't load content, because it was not correctly specified.  Sorry about that.";
    }
}

/**
 * When the window is narrow, the list of possible streams appears as one of the attachment tabs.  The considerations
 * for that particular tab are a little special 'cuz of that extra display line, so it gets its own function.
 *
 * @function
 * @param caller
 */
function switchTabs_streamsList(caller) {
    switchTabs_reset(caller);
    document.getElementsByClassName('sidebar')[0].style.display = 'block';
    vm.currentAttachment(null);
}

/**
 * Resets the tabs and marks the tab itself as 'active' for styling.
 *
 * @function
 * @param caller
 */
function switchTabs_reset(caller) {
    /* Hide other content sections. */
    if (vm.currentAttachment() !== null) {
        vm.currentAttachment().contentBox.style.display = 'none';
    }

    var sidebars = document.getElementsByClassName('sidebar');
    if (sidebars.length > 0)
        sidebars[0].style.display = '';

    /* Remove 'active' class from tab */
    if (caller !== undefined) {
        var tabs = caller.parentNode.parentNode.children;
        for (var ti in tabs) {
            if (!tabs.hasOwnProperty(ti))
                continue;
            tabs[ti].classList.remove('active');
        }

        /* Add 'active' class to caller tab */
        caller.parentNode.classList.add('active');
    }

}

/**
 * Create and send the Live XHR Request
 *
 * @function
 */
function doRequest() {
    var req = new XMLHttpRequest(),
        eventId = getUrlParameter("event");
    req.Timeout = 3800;
    req.withCredentials = true;
    req.addEventListener('load', liveStreamJsonListener);
    req.addEventListener('timeout', liveStreamJsonTimeout);
    // req.open("GET", scriptBase + "json/test.json");
    if (container === head) // status mode
        req.open("GET", scriptBase + "json/" + (isTestingMode ? '?test='+isTestingMode : ''));
    else // video mode
        req.open("GET", scriptBase + "json/?current=" + vm.currentMode() + (isTestingMode ? '&test='+isTestingMode : '') + (eventId ? '&event='+eventId : ''));
    req.send();
}

/**
 * Handler for when the XHR times out.  TODO figure out a good way for reporting this back to some analytics mechanism.
 *
 * @function
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
    return JSON.stringify(_getProgramFromSourceId(sourceId)) !== "{}";
}

/**
 * Returns the program (event) object which contains a given sourceId.
 *
 * @function
 * @param {string} sourceId
 * @returns {object}
 * @private
 */
function _getProgramFromSourceId(sourceId) {
    var prg = vm.livePrograms().find(function (prg) {
        return undefined !== prg.sources.find(function(src) {
            return(src.id === this.id);
        }, this);
    }, {"id":sourceId});
    if (prg !== undefined)
        return prg;
    prg = vm.archive().find(function (prg) {
        return undefined !== prg.sources.find(function(src) {
            return(src.id === this.id);
        }, this);
    }, {"id":sourceId});
    if (prg !== undefined)
        return prg;
    return {};
}

/**
 * Starts playing a given source.
 *
 * @function
 * @param source {object} A source object from within a LiveEvent object.
 */
function playSource(source) {
    createMediaFrame();
    var newProgram = _getProgramFromSourceId(source.id);
    if (JSON.stringify(vm.currentProgram) !== JSON.stringify(newProgram)) {
        // New program is different from current one (attachments and such thus change).
        vm.currentProgram(newProgram);
        window.history.pushState(null, null, "?event=" + vm.currentProgram().id);
        if (typeof ga === 'function')  // assume Google Analytics is loaded.
            ga('send', 'event', { 'eventCategory': 'Livestream', 'eventAction': 'Select Program', 'eventLabel': 'Program ' + vm.currentProgram().id });
        if (vm.currentProgram().attachments.length > 0 && document.getElementsByClassName('attachmentContentSection').length > 0)
            selectAttachment(vm.currentProgram().attachments[0]);
    }
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

// noinspection JSUnusedGlobalSymbols
/**
 * Provides the verb to use to describe the primary interaction with each stream.
 *
 * @function
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
 * Play a YouTube source.
 *
 * @function
 * @param source {object} A source object from within a LiveEvent object.
 */
function playYouTube(source) {
    mediaElt.src = source.url;
    // TODO invoke YT JS API to determine if user interacts while this video is presented.
}

/**
 * Play a video within an iFrame with no vendor-specific arrangements.
 *
 * @function
 * @param source {object} A source object from within a LiveEvent object.
 */
function playIFrame(source) {
    mediaElt.src = source.url;
}

/**
 * Clear the mediaElement and replace with a space for text.
 *
 * @function
 */
function clearMediaWindow() {
    container.removeChild(mediaElt);
    mediaElt = document.createElement('p');
    container.appendChild(mediaElt);
}

/**
 * Clear the mediaElement and replace with an iFrame for inserting video into.
 *
 * @function
 */
function createMediaFrame() {
    container.removeChild(mediaElt);
    mediaElt = document.createElement('iframe');
    mediaElt.classList.add("video_mediaElt");
    mediaElt.setAttribute('allowFullScreen','');
    mediaElt.setAttribute('scrolling','no');
    container.appendChild(mediaElt);
}

/**
 * Extract a given URL Parameter from the request bar.
 *
 * @function
 * @param name {string}  The name of the parameter for which the value is sought.
 * @returns {string|undefined}  The value of the specified parameter.
 *
 * @link https://stackoverflow.com/a/11582513/2339939
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

// noinspection JSUnusedGlobalSymbols
/**
 * Comparison function for sorting sources by their verb.  Puts "Watch" first.
 *
 * @function
 * @param a {object} A source object
 * @param b {object} A source object
 * @returns {number}
 */
function compareSourceByVerb(a, b) {
    if (playVerb(a) === playVerb(b))
        return 0;
    if (playVerb(a) === 'Watch')
        return -1;
    if (playVerb(b) === 'Watch')
        return 1;
    return 0;
}

/**
 * @summary Script for embedding live videos from various streaming providers into Tenth.org
 *
 * @author James Kurtz
 * @copyright 2017
 * @licence See https://github.com/TenthPres/livestreams for terms
 */


class Livestream {

    // scriptBase = document.scripts[document.scripts.length-1].src.replace(/(\/\/.*?\/.*\/).*/g,"$1");  // TODO make static once FF supports
    // singleton = null;  // TODO make static once FF supports


    /**
     *
     *
     * @function
     */
    constructor() {

        // Declare properties
        this.mode = null;
        this.container = null;
        this.mediaElt = null;
        this.self = null;
        this.vm = {
            interval: null,
            runs: {
                live: [],
                archive: [],
                upcoming: []
            },
            orderContent: [],
            hymnContent: [],
            scriptureContent: [],
            preferHymnLyrics: null
        };


        // Declare static properties
        if (Livestream.singleton === undefined) {
            Livestream.singleton = null;

        }

        // Constructor, proper
        if (Livestream.singleton === null) {

            Livestream.singleton = this;
            this.self = this;

            if (document.getElementsByClassName('livestream-container').length === 0) {
                this.mode = "status"; // only relays status

                this.loadLivestreamStatus();
                if (this.vm.interval !== null)
                    clearInterval(this.vm.interval);
                this.vm.interval = setInterval(this.loadLivestreamStatus, 30000);

            } else {

                this.mode = "player"; // uses a player
                /** Create new HTML elements & define variables */
                let knockoutLib = document.createElement('script');
                this.mediaElt = document.createElement('p');

                /** Load Knockout, if it isn't loaded */
                if (!window.hasOwnProperty("ko")) {
                    knockoutLib.src = '//cdnjs.cloudflare.com/ajax/libs/knockout/3.5.0/knockout-min.js';
                    knockoutLib.type = 'text/javascript';
                    let that = this;
                    knockoutLib.addEventListener("load", function() {that.initalizeModels()}, true);
                    document.getElementsByTagName("head")[0].appendChild(knockoutLib);
                } else {
                    this.initalizeModels();
                }

                this.container = document.getElementsByClassName('livestream-container')[0];

                /** Insert "Loading..." into the video container. */
                this.mediaElt.innerHTML = "loading...";
                this.container.appendChild(this.mediaElt);
            }
        } else {
            console.error("Not a livestream singleton.")
        }
    }


    /**
     * Initialize the observables in the view model with Knockout.
     *
     * @function
     */
    initalizeModels() {

        this.vm.runs.live = ko.observableArray([]);
        this.vm.runs.archive = ko.observableArray([]);
        this.vm.runs.upcoming = ko.observableArray([]);
        this.vm.messages = ko.observableArray([]);
        this.vm.currentRun = ko.observable({}); // the whole program
        this.vm.currentSource = ko.observable("loading"); // the source id
        this.vm.currentOrder = ko.observable({});
        this.vm.currentAttachment = ko.observable(null);
        this.vm.preferHymnLyrics = ko.observable(true);

        ko.applyBindings(this.vm, document.body);

        this.loadLivestreamStatus();
        if (this.vm.interval !== null)
            clearInterval(this.vm.interval);
        let that = this;
        this.vm.interval = setInterval(function() { that.loadLivestreamStatus(); }, 10000);
    }

    /**
     * Create and send the Live XHR Request
     *
     * @function
     */
    loadLivestreamStatus() {
        let xhr = new XMLHttpRequest(),
            runId = getUrlParameter("event"),
            that = this;
        xhr.Timeout = 4000;
        xhr.withCredentials = true;
        xhr.addEventListener('load', function() {that.loadLivestreamStatus_listener(this)}, true);
        xhr.addEventListener('timeout', function() {that.loadLivestreamStatus_timeout()}, true);

        if (this.mode === "status")
            xhr.open("GET", Livestream.scriptBase + "live/json/" + (getUrlParameter('test') !== undefined ? "?test" : ""));
        else // video mode
            xhr.open("GET", Livestream.scriptBase + "live/json/?s=" + this.vm.currentSource() + (runId ? '&r=' + runId : '') + (getUrlParameter('test') !== undefined ? "&test" : ""));
        xhr.send();
        if (typeof ga === 'function' && this.vm.currentRun().hasOwnProperty('_id'))  // assume Google Analytics is loaded.
            ga('send', 'event', { 'eventCategory': 'Livestream', 'eventAction': 'Ping', 'eventLabel': 'Program ' + this.vm.currentRun()._id });
    }

    /**
     * Listener for Live XHR Response
     *
     * @function
     */
    loadLivestreamStatus_listener(xhr) {

        // receive response.
        let response = JSON.parse(xhr.responseText),
            livestreamActiveBodyClassName = "livestreamActive";

        // update status class
        if (document.body.classList.contains(livestreamActiveBodyClassName) && response.live.length <= 0)
            document.body.classList.remove(livestreamActiveBodyClassName);
        if (!document.body.classList.contains(livestreamActiveBodyClassName) && response.live.length > 0)
            document.body.classList.add(livestreamActiveBodyClassName);

        // if we only care about status, then stop here.
        if (this.mode === 'status')
            return;

        if (typeof this.vm.runs.live !== "function" || JSON.stringify(this.vm.runs.live()) !== JSON.stringify(response.live)) { // update vm streams if there's a change
            this.vm.runs.live(response.live);
        }

        if (JSON.stringify(this.vm.runs.archive()) !== JSON.stringify(response.archive)) { // update vm archive if there's a change
            this.vm.runs.archive(response.archive);
        }

        if (JSON.stringify(this.vm.runs.upcoming()) !== JSON.stringify(response.upcoming)) { // update vm upcoming if there's a change
            this.vm.runs.upcoming(response.upcoming);
        }

        if (!this.sourceIsValid(this.vm.currentSource())) { // if the client is watching a source that's no longer valid.
            this.clearMediaWindow();
            this.vm.currentSource("loading");
            this.vm.currentRun({});
        }

        if (this.vm.currentSource() === "loading") { // if the client is in "loading" mode
            let ev = parseInt(getUrlParameter("event")),
                evObj = undefined;

            if (getUrlParameter("event") > 0) {

                // find the program object in the available streams.
                evObj = this.vm.runs.live().find(function(evO) {
                    return evO._id === ev;
                });
                if (evObj === undefined) {
                    evObj = this.vm.runs.archive().find(function(evO) {
                        return evO._id === ev;
                    });
                }
                if (evObj === undefined) {
                    evObj = this.vm.runs.upcoming().find(function(evO) {
                        return evO._id === ev;
                    });
                }

                // Play source for object
                if (evObj !== undefined) {
                    if (evObj.sources.length > 0) {
                        this.playSource(evObj.sources[0], evObj);
                    }
                } else {
                    this.mediaElt.innerHTML = "The livestream you're looking for isn't currently available.";
                    if (response.live.length > 0) {
                        this.mediaElt.innerHTML += "<br />However, others are live now."
                    }
                }
            } else {
                if (response.live.length > 0) {
                    if (response.live[0].sources.length > 0) {
                        this.playSource(response.live[0].sources[0], response.live[0]);
                    } else {
                        this.mediaElt.innerHTML = "A livestream is currently available, but is not compatible with your browser.<br />Please consider using a different browser."
                    }
                } else {
                    this.mediaElt.innerHTML = "There is no livestream currently available.<br />We will display the livestream here as soon as it begins."
                }
            }
        }

        /* Handle messages */
        // TODO figure out a method for hashing messages so they don't all need to be sent every time.
        // TODO apply that hashing mechanism to descriptions, too.
        if (response.messages !== undefined && JSON.stringify(this.vm.messages()) !== JSON.stringify(response.messages)) { // updates only if there's a change.  (Helps avoid needless UI refresh)
            this.vm.messages(response.messages);
            if (document.body.getElementsByClassName('video_messages').length > 0)
                document.body.getElementsByClassName('video_messages')[0].innerHTML = this.vm.messages().join('<br /><br />');
        }
    }

    /**
     * Handler for when the XHR times out.  TODO figure out a good way for reporting this back to some analytics mechanism.
     *
     * @function
     */
    loadLivestreamStatus_timeout() {
        window.console.info('XHR Timeout');
    }


    /**
     * Clear the mediaElement and replace with a space for text.
     *
     * @function
     */
    clearMediaWindow() {
        this.container.removeChild(this.mediaElt);
        this.mediaElt = document.createElement('p');
        this.container.appendChild(this.mediaElt);
    }


    /**
     * Clear the mediaElement and replace with an iFrame for inserting video into.
     *
     * @function
     */
    createMediaFrame() {
        this.container.removeChild(this.mediaElt);
        this.mediaElt = document.createElement('iframe');
        this.mediaElt.classList.add("video_mediaElt");
        this.mediaElt.setAttribute('allowFullScreen','');
        this.mediaElt.setAttribute('scrolling','no');
        this.container.appendChild(this.mediaElt);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Starts playing a given source.
     * When called, this should be bound to the object.
     *
     * @function
     * @param source {object} A source object from within a LiveEvent object.
     * @param run {object} The run object now to be played.
     */
    playSource(source, run) {
        this.createMediaFrame();
        if (JSON.stringify(this.vm.currentRun()) !== JSON.stringify(run)) {
            // New program is different from current one (attachments and such thus change).
            this.vm.currentRun(run);
            window.history.pushState(null, null, "?event=" + this.vm.currentRun()._id + (getUrlParameter('test') !== undefined ? "&test" : ""));
            if (typeof ga === 'function')  // assume Google Analytics is loaded.
                ga('send', 'event', { 'eventCategory': 'Livestream', 'eventAction': 'Select Program', 'eventLabel': 'Program ' + this.vm.currentRun()._id });


            this.loadOrderContent(this.vm.currentRun().order._id);
        }
        this.vm.currentSource(source._id);
        switch (source.provider) {
            case "yt":
                this.playYouTube(source);
                return;

            case "fb":
                this.playFacebook(source);
                return;

            case "vm":
                this.playVimeo(source);
                return;

            case "sa":
                this.playSA(source);
                return;
        }
        console.error("Source unplayable because provider is unknown.")
    }

    /**
     * Play a YouTube source.
     *
     * @function
     * @param source {object} A source object from within a LiveEvent object.
     */
    playYouTube(source) {
        this.mediaElt.src = "//www.youtube.com/embed/" + source.providerId + "?autoplay=1&rel=0&showinfo=0&color=white";
        // TODO invoke YT JS API to determine if user interacts while this video is presented.
    }

    /**
     * Play a Vimeo source.
     *
     * @function
     * @param source {object} A source object from within a LiveEvent object.
     */
    playVimeo(source) {
        this.mediaElt.src = "//player.vimeo.com/video/" + source.providerId + "?color=b61c24&api=1";
    }

    /**
     * Play a Facebook source.
     *
     * @function
     * @param source {object} A source object from within a LiveEvent object.
     */
    playFacebook(source) {
        this.mediaElt.src = "//www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ftenth%2Fvideos%2F" + source.providerId + "%2F&width=400";
    }

    /**
     * Play a SermonAudio audio or video stream with no vendor-specific arrangements.
     *
     * @function
     * @param source {object} A source object from within a LiveEvent object.
     */
    playSA(source) {
        this.mediaElt.src = "//embed.sermonaudio.com/player/l/tenth/?autoplay=true" + (source.providerId === "aud" ? "&quality=audio" : "");
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
    streamLabel(source) {
        let s = "";

        switch (source.provider) {
            case "yt":
                s += "YouTube Video";
                break;

            case "fb":
                s += "Facebook Live";
                break;

            case "vm":
                s += "Vimeo";
                break;

            case "sa":
                s += "SermonAudio";
                break;
        }

        if (this.vm.currentSource() === source._id)
            s += "\nNow Playing";

        return s;
    }

    loadOrderContent(orderId) {
        if ((!this.vm.currentRun().order.hasHtml && !this.vm.currentRun().order.hasJson) || this.vm.orderContent[this.vm.currentRun().order._id] !== undefined) {
            return;
        }

        let xhr = new XMLHttpRequest(),
            that = this;
        xhr.Timeout = 2000;
        xhr.addEventListener('load', function() {that.loadOrderContent_listener(this)}, true);

        xhr.open("GET", Livestream.scriptBase + "wo/content.php?o=" + orderId);
        xhr.send();
    }


    loadOrderContent_listener(xhr) {
        // receive response.
        let response = JSON.parse(xhr.responseText);

        // put response in vm where it can be referenced.
        this.vm.orderContent[response._id] = response;

        // update attachments
        if (this.vm.currentRun().order._id === response._id)
            this.vm.currentOrder(this.vm.orderContent[response._id]);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Provides the verb to use to describe the primary interaction with each stream.
     *
     * @function
     * @param source {object} A source object from within a LiveEvent object.
     * @returns {string} The pertinent verb
     */
    static playVerb(source) {
        switch (source.provider) {
            case "yt":
            case "fb":
            case "vm":
                return "Watch";

            case "sa":
                if (source.providerId === 'aud') {
                    return "Listen";
                }
                return "Watch";
        }
        return "Join" // seems to be the most generic term that would apply, even if watch/listen don't.
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
    static compareSourceByVerb(a, b) {
        if (Livestream.playVerb(a) === Livestream.playVerb(b))
            return 0;
        if (Livestream.playVerb(a) === 'Watch')
            return -1;
        if (Livestream.playVerb(b) === 'Watch')
            return 1;
        return 0;
    }

    /**
     * @function Determines if a source with a given ID is currently valid for display.  Most useful for after a live events ends.
     * @param {object} source  The source object.
     * @returns {boolean}  True of the source is valid for display.
     */
    sourceIsValid(source) {
        if (source === 'loading') // 'loading' is always a valid source because of the possibility that it could be paused.
            return true;

        if (source.provider === "yt") // youtube is always a valid source.
            return true;

        if (source.provider === "fb") // facebook is only a valid source when live or past.
            return (source.status === "LIVE" || source.status === "COMPLETED");

        if (source.provider === "vm") // vimeo is only a valid source when past (for now).
            return (source.status === "COMPLETED");

        // for everything else, if it's in the list of current sources, it's valid.  If it's not, it's not.
        return true // TODO make useful.
    }



    // noinspection JSUnusedGlobalSymbols
    /**
     * For UI iterations that allow attachments (scripture, order of worship, etc.) to be shown to the user.
     *
     * @param attachment {object} The attachment object, originating with the json response.
     * @param event {event} Optional. The event (probably click) by which the attachment has been selected.
     */
    selectAttachment(attachment, event) {

        if (this.vm.currentAttachment() !== null) {
            this.vm.currentAttachment().contentBox.classList.add("hidden");
        }

        // initialize attachment, if not initialized already.
        if (!attachment.hasOwnProperty('contentBox')) {

            if (attachment.hasOwnProperty('html')) { // Order of Worship.  Also provides some future flexibility for other things that have their HTML pre-defined.
                attachment.contentBox = document.createElement('div');
                attachment.contentBox.classList.add('attachment');
                document.getElementsByClassName('attachmentContentSection')[0].appendChild(attachment.contentBox);
                attachment.contentBox.classList.add('orderOfWorship');
                attachment.contentBox.innerHTML = attachment.html;

            } else if (attachment.name.substr(0, 3) === "TH ") { // Hymnal

                if (!this.vm.hymnContent.hasOwnProperty(attachment.name)) {
                    attachment.contentBox = this.loadAttachment_hymn(attachment.name.substr(3));
                    attachment.type = "hymn";
                } else {
                    attachment.contentBox = this.vm.hymnContent[attachment.name].contentBox;
                }

            } else {
                if (!this.vm.scriptureContent.hasOwnProperty(attachment.name)) {
                    attachment.contentBox = this.loadAttachment_scripture(attachment.name);
                } else {
                    attachment.contentBox = this.vm.scriptureContent[attachment.name].contentBox;
                }
            }
        }
        this.vm.currentAttachment(attachment);
        attachment.contentBox.classList.remove('hidden');

        if (typeof ga === 'function') { // assume Google Analytics is loaded.
            ga('send', 'event', { 'eventCategory': 'Livestream', 'eventAction': 'Attachment: ' + attachment.type, 'eventLabel': attachment.name });
        }
    }


    loadAttachment_hymn(number) {
        this.vm.hymnContent[number] = {
            contentBox: document.createElement('div'),
            lyricsBox: null,
            musicBox: null
        };
        this.vm.hymnContent[number].contentBox.classList.add('attachment');
        document.getElementsByClassName('attachmentContentSection')[0].appendChild(this.vm.hymnContent[number].contentBox);

        let lyricsBox = document.createElement('div'),
            musicBox = document.createElement('div');

        lyricsBox.classList.add('subattachment');
        musicBox.classList.add('subattachment');
        lyricsBox.innerHTML = "Loading...";
        musicBox.innerHTML = "Loading...";
        lyricsBox.setAttribute('data-bind', 'visible: L.vm.preferHymnLyrics() === true');
        musicBox.setAttribute('data-bind', 'visible: L.vm.preferHymnLyrics() === false');

        this.vm.hymnContent[number].contentBox.appendChild(lyricsBox);
        this.vm.hymnContent[number].contentBox.appendChild(musicBox);

        this.vm.hymnContent[number].lyricsBox = lyricsBox;
        this.vm.hymnContent[number].musicBox = musicBox;

        ko.applyBindings(this.vm, this.vm.hymnContent[number].contentBox);

        let xhr = new XMLHttpRequest(),
            that = this;
        xhr.Timeout = 2000;
        xhr.addEventListener('load', function() {that.loadAttachment_hymn_listener(this)}, true);

        xhr.open("GET", Livestream.scriptBase + "wo/hymn.php?h=" + number);
        xhr.send();

        return this.vm.hymnContent[number].contentBox;
    }

    loadAttachment_hymn_listener(xhr) {
        let response = JSON.parse(xhr.responseText);
        if (!response.hasOwnProperty('num')) {
            console.error("Server did not provide hymn number is response.");
            return;
        }
        if (response.hasOwnProperty('text') && response.text !== null) {
            if (response.text === false) {
                this.vm.hymnContent[response.num].lyricsBox.innerHTML = "<p>Due to copyright constraints, we cannot provide the lyrics for this hymn online.</p>";
            } else {
                this.vm.hymnContent[response.num].lyricsBox.innerHTML = response.text;
            }
        }
        if (response.hasOwnProperty('images') && response.images !== null) {
            if (response.images === false) {
                this.vm.hymnContent[response.num].musicBox.innerHTML = "<p>Due to copyright constraints, we cannot provide the music for this hymn online.</p>";
            } else {
                this.vm.hymnContent[response.num].musicBox.innerHTML = "";
                for (let im in response.images) {
                    if (!response.images.hasOwnProperty(im))
                        continue;
                    let io = document.createElement('img');
                    io.src = response.images[im];
                    this.vm.hymnContent[response.num].musicBox.appendChild(io);
                }
            }
        }
    }

    loadAttachment_scripture(ref) {
        this.vm.scriptureContent[ref] = {
            contentBox: document.createElement('div')
        };
        this.vm.scriptureContent[ref].contentBox.classList.add('attachment');
        document.getElementsByClassName('attachmentContentSection')[0].appendChild(this.vm.scriptureContent[ref].contentBox);
        this.vm.scriptureContent[ref].contentBox.innerHtml = "Loading...";

        let xhr = new XMLHttpRequest(),
            that = this;
        xhr.Timeout = 2000;
        xhr.addEventListener('load', function() {that.loadAttachment_scripture_listener(this)}, true);

        xhr.open("GET", Livestream.scriptBase + "wo/esv.php?q=" + ref);
        xhr.send();

        return this.vm.scriptureContent[ref].contentBox;
    }

    loadAttachment_scripture_listener(xhr) {
        let response = JSON.parse(xhr.responseText);
        this.vm.scriptureContent[response.ref].contentBox.innerHTML = response.passages[0];
    }


    /**
     * Resets the tabs and marks the tab itself as 'active' for styling.
     *
     * @function
     * @param caller
     */
    switchTabs_reset(caller) {
        /* Hide other content sections. */
        if (this.vm.currentAttachment() !== null) {
            this.vm.currentAttachment().contentBox.style.display = 'none';
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

}


// noinspection JSUnusedGlobalSymbols
// /**
//  * For UI iterations that allow attachments (scripture, order of worship, etc.) to be shown to the user.
//  *
//  * @param attachment {object} The attachment object, originating with the json response.
//  * @param event {event} Optional. The event (probably click) by which the attachment has been selected.
//  */
// function selectAttachment(attachment, event) {
//     if (event !== undefined)
//         switchTabs_reset(event.target);
//     else
//         switchTabs_reset();
//     if (!attachment.hasOwnProperty('contentBox')) {
//         attachment.contentBox = document.createElement('div');
//         attachment.contentBox.classList.add('attachment');
//         document.getElementsByClassName('attachmentContentSection')[0].appendChild(attachment.contentBox);
//         if (attachment.name.substr(0, 3) === "TH ") { // Hymnal
//             attachment.type = "Hymn";
//             populateAttachment_TH(attachment);
//         } else if (attachment.hasOwnProperty("ifrUrl")) {
//             attachment.type = "Document";
//             populateAttachment_ifr(attachment);
//         } else {
//             attachment.type = "Scripture";
//             populateAttachment_ESV(attachment);
//         }
//     }
//     vm.currentAttachment(attachment);
//     attachment.contentBox.style.display = "";
//     if (typeof ga === 'function') { // assume Google Analytics is loaded.
//         ga('send', 'event', { 'eventCategory': 'Livestream', 'eventAction': 'Attachment: ' + attachment.type, 'eventLabel': attachment.name });
//     }
// }


// function populateAttachment_TH(attachment) {
//     attachment.contentBox.innerHTML = "<p>loading...</p>";
//     var hymnNumber = attachment.name.substr(3),
//         xhr = new XMLHttpRequest();
//     xhr.open('GET', scriptBase + 'attachments/TH/?h=' + hymnNumber);
//     xhr.addEventListener('load', function() {
//         if (this.responseText === '') {
//             attachment.contentBox.innerHTML = "<p>Due to copyright constraints, we cannot provide the music for this hymn online.</p>"
//         } else {
//             attachment.contentBox.innerHTML = this.responseText;
//         }
//     });
//     xhr.send();
// }
//
//
// function populateAttachment_ESV(attachment) {
//     attachment.contentBox.innerHTML = "<p>loading...</p>";
//     var passage = attachment.name.split(':',3),
//         xhr = new XMLHttpRequest();
//
//     if (passage.length > 2 && passage[1].indexOf("-") !== -1)
//         passage = passage[0] + "-" + passage[1].split('-')[1];
//     else
//         passage = passage[0];
//     xhr.open('GET', scriptBase + 'attachments/ESV/?q=' + passage);
//     xhr.addEventListener('load', function() {
//         if (this.responseText === '') {
//             attachment.contentBox.innerHTML = "<p>Hmmm... couldn't load the passage.  Sorry about that.</p>"
//         } else {
//             attachment.contentBox.innerHTML = this.responseText;
//         }
//     });
//     xhr.send();
// }
//
//
// function populateAttachment_ifr(attachment) {
//     if (attachment.hasOwnProperty('ifrUrl')) {
//         var ifr = document.createElement('iframe');
//         ifr.src = attachment.ifrUrl;
//         attachment.contentBox.appendChild(ifr);
//     } else {
//         attachment.contentBox.innerHTML = "Can't load content, because it was not correctly specified.  Sorry about that.";
//     }
// }

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
 * Extract a given URL Parameter from the request bar.
 *
 * @function
 * @param name {string}  The name of the parameter for which the value is sought.
 * @returns {string|undefined|null}  The value of the specified parameter.
 *              Undefined if parameter is absent,
 *              null if parameter is present but has no definition.
 *
 * @link https://stackoverflow.com/a/11582513/2339939
 */
function getUrlParameter(name) {
    let uri = (new RegExp('[?&](' + name + ')(?:=([^&;]+))?').exec(location.search) || ['&', undefined, undefined]);
    if (uri[1] === name) {
        if (uri[2] === undefined)
            return null;
        return decodeURIComponent(uri[2].replace(/\+/g, '%20'));
    }
    return undefined;
}


/**
 * Send some stuff to Google Analytics concerning hit sources.
 */
function startupAnalytics() {
    if (getUrlParameter('mc_eid')) {
        ga('set', 'dimension1', getUrlParameter('mc_eid'));
    }

}


/** Initializations */
let L = null;
// Livestream.scriptBase = document.scripts[document.scripts.length - 1].src.replace(/(\/\/.*?\/.*\/).*/g, "$1");
Livestream.scriptBase = "//west.tenth.org/";

if (document.readyState === 'complete') {
    L = new Livestream();

    startupAnalytics();
} else {
    window.addEventListener('load', function() {
        L = new Livestream();

        startupAnalytics();
    });
}



// load the knockout library & separate css file
var knockoutLib = document.createElement('script'),
    head  = document.getElementsByTagName('head')[0],
    stylesht = document.createElement('link'),
    scripts = document.getElementsByTagName('script'),
    container = scripts[scripts.length-1].parentNode,
    scriptBase = scripts[scripts.length-1].src.replace(/(\/\/.*?\/.*\/).*/g, '$1'),
    mediaElt = document.createElement('p'),
    div = document.createElement('div'),
    progList = document.createElement('div'),
    vm = {},
    isTestingMode = !(getUrlParameter('test') !== null);

knockoutLib.src = scriptBase + 'node_modules/knockout/build/output/knockout-latest.js';
knockoutLib.type = 'text/javascript';
knockoutLib.onload = initalizeModels;
head.appendChild(knockoutLib);

stylesht.rel  = 'stylesheet';
stylesht.type = 'text/css';
stylesht.href = scriptBase + 'style.min.css';
head.appendChild(stylesht);

// impose some styling on the container.
    container.style.width = "100%";
    container.style.paddingBottom = "56.25%";   // 16:9 ratio
    container.style.marginBottom = "4em";   // space for progList
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
    progList.setAttribute("data-bind", "foreach: lsj.vm.livePrograms");
    progList.setAttribute("oncontextmenu", "return false;");
    progList.innerHTML = "<div data-bind=\"foreach: sources, visible: sources.length > 1 \"><a data-bind=\"attr: {title: providerName(type), class: type, id: id }, css: { 'active': vm.currentMode() === id }, click: playSource \"></a></div>";
    container.appendChild(progList);

// insert "loading" into container.
//mediaElt.style.width = "100%";
    mediaElt.style.top = "47%";
    mediaElt.style.transform = "translateY(-50%)";
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

        lsj.vm.livePrograms = ko.observableArray([]);
        lsj.vm.currentMode = ko.observable("loading");

        ko.applyBindings(lsj.vm, container);

        doRequest();
        setInterval(doRequest, 5000);
    }

// listener for response from server
    function liveStreamJsonListener() {
        // validate status
        if (this.status !== 200) {
            console.log("XHR Status " + this.status);
            return;
        }

        // receive response.
        var response = JSON.parse(this.responseText);

        lsj.vm.livePrograms(response.live);

    if (vm.currentMode() === "loading") { // if the client is in "loading" mode
        if (response.live.length > 0) {
            playSource(response.live[0].sources[0]);
        } else {
            mediaElt.innerHTML = "There is no livestream currently available.<br />We will display the livestream here as soon as it begins."
        }
    }
    
    document.body.getElementsByClassName('video_messages')[0].innerHTML = response.msg.join('<br /><br />');

        if (lsj.vm.currentMode() == "loading") { // if the client is in "loading" mode
            if (response.live.length > 0) {
                playSource(response.live[0].sources[0]);
            } else {
                mediaElt.innerHTML = "There is no livestream currently available.<br />We will display the livestream here as soon as it begins."
            }
        }

        document.body.getElementsByTagName('strong')[0].innerHTML = response.msg.join('<br /><br />');

    }

    function doRequest() {
        var req = new XMLHttpRequest();
        req.Timeout = 4000;
        req.withCredentials = true;
        req.addEventListener('load', liveStreamJsonListener);
        req.addEventListener('timeout', liveStreamJsonTimeout);
        req.open("GET", scriptBase + "json/?current=" + lsj.vm.currentMode() + (isTestingMode ? '&test=1' : ''));
        req.send();
    }

    function liveStreamJsonTimeout() {
        window.console.info('XHR Timeout.');
    }

    function sourceIsValid(sourceId) {
        if (sourceId === 'loading') // 'loading' is always a valid source.
            return true;

        if (sourceId.indexOf('yt-') > -1) // youtube is always a valid source (at least, for now).
            return true;

        // for everything else, if it's in the list of current sources, it's valid.  If it's not, it's not.
        return undefined !== lsj.vm.livePrograms().find(function (prg) {
                return undefined !== prg.sources.find(function (src) {
                        return (src.id === this.id);
                    }, this);
            }, {"id": sourceId});
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
        mediaElt.setAttribute('allowFullScreen', '');
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
}
lsj();
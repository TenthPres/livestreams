var scripts = document.getElementsByTagName('script'),
    container = scripts[scripts.length-1].parentNode,
    ifr = document.createElement('iframe'),
    loadingP = document.createElement('p'),
    currentMode = null;


// impose some styling on the container.
container.style.width = "100%";
container.style.paddingBottom = "56.25%";
container.style.position = "relative";
container.style.font = "inherit";
container.style.fontFamily = "\"Whitney SSm A\", \"Whitney SSm B\", \"Open Sans\", sans-serif";

// place iframe for later.
ifr.style.width = "100%";
ifr.style.height = "100%";
ifr.style.position = "absolute";
ifr.style.left = 0;
ifr.style.right = 0;
ifr.style.border = 0;
ifr.style.display = "none";
ifr.setAttribute('allowFullScreen','');

// insert "loading" into container.
loadingP.style.width = "100%";
loadingP.style.top = "45%";
loadingP.style.position = "absolute";
loadingP.innerHTML = "loading...";
loadingP.style.backgroundColor = "#eee";
container.appendChild(loadingP);

// listener for response from server
function liveStreamJsonListener() {
    // receive response.  Determine new mode.

    // if new mode is not different from current mode, return.

    // change modes as appropriate.

    var response = JSON.parse(this.responseText);

    ifr.src = response.live.youtube[0];
    ifr.style.display = "block";

    container.appendChild(ifr);
    loadingP.style.display = "none";
}

req = new XMLHttpRequest();
req.addEventListener('load', liveStreamJsonListener);
req.open("GET", "json");
req.send();


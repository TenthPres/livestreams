
// Header Stuff.
var headerBadge = document.createElement('span'),
    headerLink = document.createElement('li');
headerBadge.innerHTML = "Live Now";
headerBadge.setAttribute("style", "display: inline-block;font-variant: small-caps;border: 1px solid red;padding: 0.1em;position: relative;line-height: 1em;height: 1.3em;border-radius: .2em;color: red; font-weight:700;");
headerLink.innerHTML = "<a href=\"/livestream\" id=\"livestreamHeaderLink\">Livestream&nbsp;</a>&nbsp;";
document.getElementsByClassName("navbar-nav nav navbar-right quicklinks")[0].appendChild(headerLink);
document.getElementById('livestreamHeaderLink').appendChild(headerBadge);


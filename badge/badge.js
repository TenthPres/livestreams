
// Header Stuff.  If this is actually going to be used, it should be implemented more like the stuff below.
var headerBadge = document.createElement('span'),
    headerLink = document.createElement('li');
headerBadge.innerHTML = "Live Now";
headerBadge.setAttribute("style", "display: inline-block;font-variant: small-caps;border: 1px solid red;padding: 0.1em;position: relative;line-height: 1em;height: 1.3em;border-radius: .2em;color: red; font-weight:700;");
headerLink.innerHTML = "<a href=\"/livestream\" id=\"livestreamHeaderLink\">Livestream&nbsp;</a>&nbsp;";
document.getElementsByClassName("navbar-nav nav navbar-right quicklinks")[0].appendChild(headerLink);
document.getElementById('livestreamHeaderLink').appendChild(headerBadge);


// This adds a magical class name to the body tag.  When present, the "Live Now" stuff lights up.
document.body.classList.add('livestreamActive');


// This just adds a style sheet.  It could probably just as well be added directly to the body.

var stylesht = document.createElement('link'),
    head  = document.getElementsByTagName('head')[0],
    scriptBase = document.scripts[document.scripts.length-1].src.replace(/(\/\/.*?\/.*\/).*/g, '$1');

stylesht.rel  = 'stylesheet';
stylesht.type = 'text/css';
stylesht.href = scriptBase + 'badgeActive.min.css';
head.appendChild(stylesht);

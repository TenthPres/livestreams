
var badge = document.createElement('span');
badge.style = "font-size: 20px; display: block; margin-top: 1em; font-variant: small-caps; border: 1px solid red; padding: .3em; border-radius: .2em; color: red; font-family: \"Whitney SSm A\", \"Whitney SSm B&quot\", \"Open Sans\", open-sans, Sans-Serif; font-weight: 700;";
badge.innerHTML = "Live Now";
document.getElementsByClassName("fa fa-play")[0].appendChild(badge);


var headerBadge = document.createElement('span'),
    headerLink = document.createElement('li');
headerBadge.innerHTML = "Live Now";
headerBadge.style = "display: inline-block;font-variant: small-caps;border: 1px solid red;padding: 0.1em;position: relative;line-height: 1em;height: 1.2em;border-radius: .2em;color: red;";
headerLink.innerHTML = "<a href=\"/livestream\" id=\"livestreamHeaderLink\">Livestream&nbsp;</a>&nbsp;";
document.getElementsByClassName("navbar-nav nav navbar-right quicklinks")[0].appendChild(headerLink);
document.getElementById('livestreamHeaderLink').appendChild(headerBadge);
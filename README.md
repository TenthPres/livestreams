Tenth.org Livestreams
=====================

This is an application used for embedding live video streams of [Tenth](http://tenth.org)'s worship services into Tenth.org from multiple streaming providers (currently YouTube, SermonAudio, and Facebook).  It can also provide some limited metadata about the program being streamed.  

The application is intended to be self-contained; embeddable on practically any Tenth website.   However, some customizations have been made to fit within the design requirements of Tenth's particular situation.   

## Usage

This library can be used in two different ways. 

### Embedding Video Players

To embed the video player, use code such as the following: 

    <div class="video">
        <script language="JavaScript" type="text/javascript" src="script.min.js"></script>
    </div>
    
The video elements will be placed in the DOM tree as siblings of the `script` node. 

### Indicate when a Livestream is available
    
To simply determine whether streams are available, place code such as the following in the *`head`* of your document. 

    <script language="JavaScript" type="text/javascript" src="script.min.js" defer></script>

When a stream is available, the `body` element will have the class `livestreamActive`.  This can thus be used to adjust the UI as dictated by your css. 

In order to only provide that status, and not embed the video players, this code *must* have the `defer` attribute present, and *must* be located in the head of the document.

## Licensure

This code repository, while open, is proprietary.  You may not use it without our explicit, written consent.  But, if you'd like such consent, just email the authors. NBD.  

## Building

This is a PHP application, which uses some Node packages for minifying and building the code for production.  To build for deployment, you will need both Composer and Node on your build machine.  

To install the Node packages used as libraries, run `npm install`.

To install the Composer packages used as libraries, run `composer install`. 

To build and minify Less and JavaScript files:

	lessc --no-color style.less > style.css
    csso -i style.css -o style.min.css
    uglifyjs script.js -o script.min.js

## Deploying

Your server can be practically any machine with PHP 5.5+.  The code was developed on Windows for deployment on AWS Linux, but OS doesn't matter much.

This package uses Guzzle to make HTTPS requests to the APIs of the streaming providers.  Guzzle is installed with composer, but make sure your server allows outgoing connections.  (Free versions of App Engine, for instance, do not.)

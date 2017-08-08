Tenth.org Livestreams
=====================

This is an application used for embedding live video streams of [Tenth](http://tenth.org)'s services into Tenth's website from multiple streaming providers (currently, YouTube and SermonAudio).  The application is intended to be self-contained; embeddable on practically any Tenth website.  

## Licensure

This code repository, while open, is proprietary.  You may not use it without our explicit, written consent.  But, if you'd like such consent, just email the authors, who would be happy to get you up and running. 

## Building & Deploying

This is a PHP application, which uses some Node packages for building.  To build and deploy, you will need both Composer and Node on your build machine.  Your server can be practically any machine with PHP 5.5.  The code was developed on Windows for deployment on AWS Linux. 

To install the Node packages used as libraries, run `npm install`.

To install the Composer packages used as libraries, run `composer install`. 

To build and minify Less and JavaScript files:

	lessc --no-color style.less > style.css
    csso -i style.css -o style.min.css
    uglifyjs script.js -o script.min.js
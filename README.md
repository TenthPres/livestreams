Tenth.org Livestreams
=====================

This is an application used for embedding live video streams of [Tenth](http://tenth.org)'s worship services into Tenth.org from multiple streaming providers (currently YouTube, SermonAudio, and Facebook).  It can also provide some limited metadata about the program being streamed.  

The application is intended to be self-contained; embeddable on practically any Tenth website.   However, some customizations have been made to fit within the design requirements of Tenth's particular situation.   

## Usage

This library can be used in two different ways. 

### Embedding Video Players

To embed the video player, use code such as the following: 

    <script language="JavaScript" type="text/javascript" src="script.min.js"></script>

The media elements (of various types) will be placed in the DOM tree as siblings of the `script` node.

### Indicate when a Livestream is available
    
To simply determine whether streams are available, place code such as the following in the `head` of your document. 

    <script language="JavaScript" type="text/javascript" src="script.min.js"></script>

When a stream is available, the `body` element will have the class `livestreamActive`.  This can thus be used to adjust the UI as dictated by your css. 

In order to only provide that status, and not embed the video players this script *must* be located in the `head` of the document.

## Licensure

This code repository, while open, is proprietary.  You may not use it without our explicit, written consent.  But, if you'd like such consent, just email the authors. NBD.  

## Building

This is a PHP application, which uses some Node packages for minifying and building the code for production.  To build for deployment, you will need both [Composer](https://getcomposer.org/) and [Node](https://nodejs.org/en/) on your build machine.    

To install the Node packages used as libraries, run `npm install`.

To install the Composer packages used as libraries, run `composer install`. 

You will need to manually rename `credentials.sample.json` to take out `.sample`, and you will need to add to that file your API key and App Token for YouTube and Facebook respectively.  [Get the YouTube API key here.](https://console.cloud.google.com/apis/credentials)  [Get a Facebook App Token here.](https://developers.facebook.com/tools/explorer/) 

To build and minify Less and JavaScript files: `npm run build`

## Deploying

Your server can be practically any machine with PHP 5.5+.  The code was developed on Windows for deployment on AWS Linux, but OS doesn't matter much.

This application can run on [Elastic Beanstalk](https://aws.amazon.com/elasticbeanstalk/getting-started/), [App Engine Flexible Environments](https://cloud.google.com/appengine/docs/php/), or with many off-the-shelf hosting providers.  

When choosing infrastructure, be aware that demand can vary dramatically depending on how the data is used.  The status-only mode sends a request to the server from every client every 15 seconds.  The video-embedding mode increases that frequency to every 5 seconds.  With a few hundred people online, this can become several thousand requests per minute. 

This package uses Guzzle to make HTTPS requests to the APIs of the streaming providers.  Guzzle is installed with composer, but make sure your server allows outgoing connections.  (Free versions of App Engine, for instance, do not.)

The files you need to deploy are:
 - Everything in the `/vendor` directory. (These are the libraries installed by Composer).
 - `/script.min.js`  This is the script file. 
 - `/style.min.css`  This is the stylesheet that defines appearances for many of the 
 - `/json/index.php`  This provides the server-side response to the clients, determining which streams to present. 
 - `/json/cron.php`  This is the script you need to have cron run in order for the APIs to be queried.  
 - `/credentials.json`  This tells the application what the API keys are for YouTube and Facebook. 

These files have been deployed to `https://west.tenth.org/live/`.

Once the files are deployed, you'll need to setup a task (probably through cron) to run `/json/cron.php` __once per minute.__

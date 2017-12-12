<?php

require_once '../vendor/autoload.php';

use \jkrrv\YouTubeLiveEmbed;
use \GuzzleHttp\Client;
use \GuzzleHttp\HandlerStack;
use \Kevinrob\GuzzleCache\CacheMiddleware;
use Kevinrob\GuzzleCache\Strategy\GreedyCacheStrategy;
use Kevinrob\GuzzleCache\Storage\DoctrineCacheStorage;
use Doctrine\Common\Cache\FilesystemCache;

$credentials = json_decode(file_get_contents('../credentials.json'));

YouTubeLiveEmbed::setApiKey($credentials->YouTube);

$r = (object)[];
$r->live = [];
$r->archive = [];
$r->msg = [];


// Create default HandlerStack, add cache to the stack.
$stack = HandlerStack::create();
$stack->push(
	new CacheMiddleware(
		new GreedyCacheStrategy(
			new DoctrineCacheStorage(
				new FilesystemCache('../tmp/')
			),
			5 // the TTL in seconds
		)
	),
	'greedy-cache'
);

$client = new Client(['handler' => $stack]);

try { // this catches quota exceeding errors.

// YouTube Query
	$ytle               = new YouTubeLiveEmbed( 'UC_GR2sUKyKPiULviFLvPDQg' );
	$ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
	$ytV                = $ytle->videos();

// YouTube: Just in case there aren't any current live streams...
	if ( isset( $_GET['test'] ) && ( intval( $_GET['test'] ) & 1 ) ) { // test video from California Academy of Natural Sciences
		$ytle               = new YouTubeLiveEmbed( 'UCZvXaNYIcapCEcaJe_2cP7A' );
		$ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
		$ytV                = $ytle->videos();
	}
} catch (GuzzleHttp\Exception\ClientException $e) {
	$ytV = [];
}

// Facebook Query
if (isset($_GET['test']) && (intval($_GET['test']) & 1)) { // test video from... wherever convenient
	$fbReq = $client->request( 'GET', "https://graph.facebook.com/v2.11/FoxNews/videos?fields=live_status%2Ctitle&limit=10&access_token=" . $credentials->Facebook );
} else {
	$fbReq = $client->request( 'GET', "https://graph.facebook.com/v2.11/tenth/videos?fields=live_status%2Ctitle&limit=10&access_token=" . $credentials->Facebook );
}
$fblObj             = json_decode($fbReq->getBody());
$facebookSrcObjects = [];
$facebookTitle      = "Livestream";
foreach ($fblObj->data as $video) {
	if (isset($video->live_status) && $video->live_status === "LIVE") {
		$facebookSrcObjects[] = (object)[
			'type' => 'fbl',
			'language' => 'en-us',
			'id' => "fbl-" . $video->id,
			'url' => "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fpages%2Fvideos%2F" . $video->id . "%2F&mute=0&autoplay=1"
		];
		if (isset($video->title)) {
			$facebookTitle = $video->title;
		}
	}
}



// SermonAudio Query

$sourceID = 'tenth';

// URL queried to determine if the webcast is online.  Currently, this ONLY determines whether the stream is online.
$sa_curl = $client->request('GET', 'https://embed.sermonaudio.com/button/l/'.$sourceID.'/')->getBody();

//$sa_urlPos = strpos($sa_curl, "file:") + 7;
//$sa_urlEnd = strpos($sa_curl, "'", $sa_urlPos);
//$sa_videoUrl = substr($sa_curl, $sa_urlPos, $sa_urlEnd - $sa_urlPos);
//$sa_urlPos = strpos($sa_curl, "image:", $sa_urlEnd) + 8;
//$sa_urlEnd = strpos($sa_curl, "'", $sa_urlPos);
//$sa_imageUrl = substr($sa_curl, $sa_urlPos, $sa_urlEnd - $sa_urlPos);
$sa = (object)[
	'isLive' => (strpos($sa_curl, "Webcast Offline") === false),

	'videoIfrUrl' => '//embed.sermonaudio.com/player/l/'.$sourceID.'/?autoplay=true',

//	'videoUrl' => $sa_videoUrl, // this is the m3u8 file

	'audioIfrUrl' => "//embed.sermonaudio.com/player/l/".$sourceID."/?autoplay=true&quality=audio",

//	'audioUrl' => $sa_videoUrl . "?wowzaaudioonly=true", // this is the m3u8 file

//	'thumbUrl' => $sa_imageUrl
];

// Create Events based on the YouTube Streams.  Assuming only one stream per event.
foreach ($ytV as $v) {
	$LO = (object)[
		'name' => $v->title,
		'priority' => 1,
		'id' => "ev-yt" . $v->id,
		'description' => $v->description,
		'sources' => [],
		'attachments' => []
		];

	// Work-around for Internet Explorer on Windows 7. (See Issue #3)
	if ($_SERVER['HTTP_USER_AGENT'] !== 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko') {
		$LO->sources[] = (object) [
			'type'     => 'yt',
			'language' => 'en-us',
			'id'       => "yt-" . $v->id,
			'url'      => "//www.youtube.com/embed/" . $v->id . "?autoplay=1&rel=0&showinfo=0&color=white",
			'thumb'    => $v->thumb_high
		];
	}

	$r->live[] = $LO;
}

$youTubeActive = (count($r->live) > 0);

// SermonAudio: Create source objects
if ($sa->isLive) {
	$sources[] = (object)[
		'type' => 'sa-vid',
		'language' => 'en-us',
		'id' => "sa-vid",
		'url' => $sa->videoIfrUrl,
//		'thumb' => $sa->thumbUrl
	];
	$sources[] = (object)[
		'type' => 'sa-aud',
		'language' => 'en-us',
		'id' => "sa-aud",
		'url' => $sa->audioIfrUrl,
//		'thumb' => $sa->thumbUrl
	];

// SermonAudio: Merge into YouTube-based event or create a new generic one.
	if (count($r->live) > 0) {
		// TODO: select which event should be selected if there are multiple options.
		$r->live[0]->sources = array_merge($r->live[0]->sources, $sources);
	} else {
		$r->live[] = (object)[
			'name' => "Livestream",
			'priority' => 1,
			'id' => "ev-sa",
			'description' => "",
			'sources' => $sources,
			'attachments' => []
		];
	}

	unset($sources);
}


// Facebook: merge into existing event or create a new one.  TODO match better, and better handle the possibility of more than one.
if (count($facebookSrcObjects) > 0) {

	if (count($r->live) > 0) {
		$r->live[0]->sources = array_merge($r->live[0]->sources, $facebookSrcObjects);
	} else {
		$r->live[] = (object)[
			'name' => $facebookTitle,
			'priority' => 1,
			'id' => "ev-" . $facebookSrcObjects[0]->id,
			'description' => "",
			'sources' => $facebookSrcObjects
		];
	}

	unset($sources);
}


// Some variables to keep things clean later.
$sid = $_COOKIE['kurtz'];
$current = (isset($_GET['current']) ? $_GET['current'] : null);


// Static Test values
if (isset($_GET['test']) && (intval($_GET['test']) & 2)) {
	$json = json_decode(file_get_contents('test.json'));
	foreach ($r as $k => &$v) {
		$v = array_merge($json->$k, $v);
	}
}

// Work-around for Internet Explorer on Windows 7. (See Issue #3)
if ($youTubeActive && $_SERVER['HTTP_USER_AGENT'] === 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko') {

	// Add Message for End-users
	if ($current === 'loading') {
		$r->msg[] = "<span style=\"color: #f00;\">Streams are available, but won't work with Internet Explorer on Windows 7.  Please consider using a different browser.</span>";
	} else {
		$r->msg[] = "Other streams are available, but won't work with Internet Explorer on Windows 7.  Please consider using a different browser.";
	}

} else {

	// Assuming first provider is the best provider, provide an indication to the user when they're watching a provider other than the first.
	if (count($r->live) > 0 && $current !== 'loading' && explode( '-', $current, 2 )[0] !== explode( '-', $r->live[0]->sources[0]->id, 2 )[0] && $youTubeActive ) {
		$r->msg[] = "A better quality stream may be available than the one you're currently watching.  <a href=\"#\" onclick='playSource(" . json_encode( $r->live[0]->sources[0] ) . "); return false;'>Click here to switch</a>.";
	}
}

// Message Presentation
//$r->msg[] = "<span style=\"background-color: yellow;\">This morning's worship services will not be broadcast due to the sensitive nature of our preacher's work.</span>  Please join us for the livestream of our Evening Service and the conclusion of our Global Outreach Conference at 6:15pm EST (23:30 UTC).  You can <a href=\"https://bit.ly/goconferences\">find previous GO Conference Services here</a>.";
$r->msg[] = "Thank you for trying the new Livestream system.  <a style=\"background-color: transparent;\" href=\"mailto:techcmte@tenth.org?subject=Livestream Beta Feedback&body=%0D%0A%0D%0A(please keep this identifier in your email) %0D%0ASI: {$sid} %0D%0A%0D%0A\">The Technology Committee would love to know what you think</a>.";

// Session & Cookie Management
session_name("kurtz");
session_set_cookie_params(3600 * 24 * 90); // 90 days
session_start();

// Headers
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: https://www.tenth.org");
header("Access-Control-Allow-Credentials: true");
header_remove('X-Powered-By');

// Body
echo json_encode($r);

// Push Response
ob_flush();
flush();

// Logging & Analytics
$f_csv = fopen("usage.csv", "a");
fputcsv($f_csv, [(new DateTime())->format('Y-m-d H:i:s'), $sid, $_SERVER['REMOTE_ADDR'], $current, $_SERVER['HTTP_USER_AGENT']]);
fclose($f_csv);
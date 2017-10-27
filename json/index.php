<?php

require_once '../vendor/autoload.php';

use \jkrrv\YouTubeLiveEmbed;
use \GuzzleHttp\Client;
use \GuzzleHttp\HandlerStack;
use \Kevinrob\GuzzleCache\CacheMiddleware;
use Kevinrob\GuzzleCache\Strategy\GreedyCacheStrategy;
use Kevinrob\GuzzleCache\Storage\DoctrineCacheStorage;
use Doctrine\Common\Cache\FilesystemCache;

YouTubeLiveEmbed::setApiKey('AIzaSyChOgE1uQkFhxo1xOOdhlSCscmTvR2YcCk');

$r = (object)[];
$r->live = [];
$r->archive = [];


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


// YouTube Query
$ytle = new YouTubeLiveEmbed('UC_GR2sUKyKPiULviFLvPDQg');
$ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
$ytV = $ytle->videos();

// YouTube: Just in case there aren't any current live streams...
if (isset($_GET['test'])) { // test video from California Academy of Natural Sciences
	$ytle = new YouTubeLiveEmbed('UCZvXaNYIcapCEcaJe_2cP7A');
	$ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
	$ytV = $ytle->videos();
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

	// it appears that there isn't a parameter for audio-only in the new embed options, so here's the old one.  See Issue #
	'audioIfrUrl' => "//www.sermonaudio.com/playwebcast.asp?sourceid=" . $sourceID . "&max=true&autoplay=true&stream=audioonly",

//	'audioUrl' => $sa_videoUrl . "?wowzaaudioonly=true", // this is the m3u8 file

//	'thumbUrl' => $sa_imageUrl
];

// Create Events based on the YouTube Streams.  Assuming only one stream per event.
foreach ($ytV as $v) {
	$r->live[] = (object)[
		'name' => $v->title,
		'priority' => 1,
		'id' => "ev-yt" . $v->id,
		'description' => $v->description,
		'sources' => [
			(object)[
				'type' => 'yt',
				'language' => 'en-us',
				'id' => "yt-" . $v->id,
				'url' => "//www.youtube.com/embed/" . $v->id . "?autoplay=1&rel=0&showinfo=0",
				'thumb' => $v->thumb_high
				]
			]
		];
}

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
			'sources' => $sources
		];
	}


	unset($sources);
}

// Some variables to keep things clean later.
$sid = $_COOKIE['kurtz'];
$current = (isset($_GET['current']) ? $_GET['current'] : null);

// Message Presentation
$r->msg = [];
$r->msg[] = "Thank you for trying the new Livestream system.  <a style=\"background-color: transparent;\" href=\"mailto:techcmte@tenth.org?subject=Livestream Beta Feedback&body=%0D%0A%0D%0A(please keep this identifier in your email) %0D%0ASI: {$sid} %0D%0A%0D%0A\">The Technology Committee would love to know what you think</a>.</strong>";

// Assuming first provider is the best provider, provide an indication to the user when they're watching a provider other than the first.
if(!is_null($current) && $current !== 'loading' && explode('-', $current,2)[0] !== explode('-', $r->live[0]->sources[0]->id, 2)[0])
	$r->msg[] = "A better quality stream may be available than the one you're currently watching.  <a href=\"#\" onclick='playSource(" . json_encode($r->live[0]->sources[0]) . "); return false;'>Click here to switch</a>.";

// Session & Cookie Management
session_name("kurtz");
session_set_cookie_params(3600 * 24 * 90); // 90 days
session_start();

// Headers
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: https://www.tenth.org");
header("Access-Control-Allow-Credentials: true");

// Body
echo json_encode($r);

// Push Response
ob_flush();
flush();

// Logging & Analytics
$f_csv = fopen("usage.csv", "a");
fputcsv($f_csv, [(new DateTime())->format('Y-m-d H:i:s'), $sid, $_SERVER['REMOTE_ADDR'], $current, $_SERVER['HTTP_USER_AGENT']]);
fclose($f_csv);
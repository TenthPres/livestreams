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

//// YouTube: Just in case there aren't any current live streams...
//if (count($ytV) == 0) { // test video from California Academy of Natural Sciences
//	$ytle = new YouTubeLiveEmbed('UCZvXaNYIcapCEcaJe_2cP7A');
//	$ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
//	$ytV= $ytle->videos();
//}


// SermonAudio Query

$sourceID = 'tenth';

$sa_curl = $client->request('GET', 'http://www.sermonaudio.com/playwebcast.asp?SourceID='.$sourceID)->getBody();

$sa_urlPos = strpos($sa_curl, "file:") + 7;
$sa_urlEnd = strpos($sa_curl, "'", $sa_urlPos);
$sa_videoUrl = substr($sa_curl, $sa_urlPos, $sa_urlEnd - $sa_urlPos);
$sa_urlPos = strpos($sa_curl, "image:", $sa_urlEnd) + 8;
$sa_urlEnd = strpos($sa_curl, "'", $sa_urlPos);
$sa_imageUrl = substr($sa_curl, $sa_urlPos, $sa_urlEnd - $sa_urlPos);
$sa = (object)[
	'isLive' => (strpos($sa_curl, "currently not in progress") === false),
	'videoIfrUrl' => "//www.sermonaudio.com/playwebcast.asp?sourceid=" . $sourceID . "&max=true&autoplay=true",
	'videoUrl' => $sa_videoUrl, // this is the m3u8 file
	'audioIfrUrl' => "//www.sermonaudio.com/playwebcast.asp?sourceid=" . $sourceID . "&max=true&autoplay=true&stream=audioonly",
	'audioUrl' => $sa_videoUrl . "?wowzaaudioonly=true", // this is the m3u8 file
	'thumbUrl' => $sa_imageUrl
];


// if live, define event.
if (count($ytV) > 0 || $sa->isLive) {
	$r->live[] = (object)[];
	$r->live[0]->name = "Tenth Presbyterian Live Stream Event"; // eventually, replace with useful things from APIs.
	$r->live[0]->priority = 1;
	$r->live[0]->id = "current-livestream"; // replace with something unique for each event
	$r->live[0]->sources = [];
}


// YouTube: source object
if (count($ytV) > 0) {
	$sources = &$r->live[0]->sources;
	$v = $ytV[0];
	$sources[] = (object)[
		'type' => 'yt',
		'language' => 'en-us',
		'id' => "yt-" . $v->id,
		'url' => "//www.youtube.com/embed/" . $v->id . "?autoplay=1&rel=0&showinfo=0",
		'thumb' => $v->thumb_high
	];
	unset($sources);
}


// SermonAudio: source object
if ($sa->isLive) {
	$sources = &$r->live[0]->sources;
	$sources[] = (object)[
		'type' => 'sa-vid',
		'language' => 'en-us',
		'id' => "sa-vid",
		'url' => $sa->videoIfrUrl,
		'thumb' => $sa->thumbUrl
	];
	$sources[] = (object)[
		'type' => 'sa-aud',
		'language' => 'en-us',
		'id' => "sa-aud",
		'url' => $sa->audioIfrUrl,
		'thumb' => $sa->thumbUrl
	];
	unset($sources);
}


// message presentation

$r->msg = [];

$r->msg[] = "Thank you for trying the new Livestream system.  <a style=\"background-color: transparent;\" href=\"mailto:techcmte@tenth.org?subject=Livestream Beta Feedback&body=%0D%0A%0D%0A(please keep this identifier in your email) %0D%0ASI: ".session_id()."%0D%0A%0D%0A\">The Technology Committee would love to know what you think</a>.</strong>";


// Response

session_name("kurtz");
session_set_cookie_params(3600 * 24 * 30); // 30 days
session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://www.tenth.org");
header("Access-Control-Allow-Credentials: true");
echo json_encode($r);

ob_flush();
flush();


$f_csv = fopen("usage.csv", "a");
fputcsv($f_csv, [(new DateTime())->format('Y-m-d H:i:s'), session_id(), $_SERVER['REMOTE_ADDR'], $_GET['current'], $_SERVER['HTTP_USER_AGENT']]);
fclose($f_csv);
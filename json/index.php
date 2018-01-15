<?php

require_once '../vendor/autoload.php';

use \jkrrv\YouTubeLiveEmbed;
use \GuzzleHttp\Client;
use \GuzzleHttp\HandlerStack;
use \Kevinrob\GuzzleCache\CacheMiddleware;
use Kevinrob\GuzzleCache\Strategy\GreedyCacheStrategy;
use Kevinrob\GuzzleCache\Storage\DoctrineCacheStorage;
use Doctrine\Common\Cache\FilesystemCache;


// Some variables to keep things clean later.
if (isset($_COOKIE['kurtz'])) {
	$sid = $_COOKIE['kurtz'];
} else {
	$sid = null;
}
$current = (isset($_GET['current']) ? $_GET['current'] : null);
$credentials = json_decode(file_get_contents('../credentials.json'));
$eventFileList = array_diff(scandir("events"), array('..', '.', 'default.json'));
$eventFileList = array_reverse($eventFileList, true);
$eventList = [];

$r = (object)[];
$r->live = [];
$r->archive = [];
$r->msg = [];

$r->msg[] = "Thank you for trying the new Livestream system.  <a style=\"background-color: transparent;\" href=\"mailto:techcmte@tenth.org?subject=Livestream Beta Feedback&body=%0D%0A%0D%0A(please keep this identifier in your email) %0D%0ASI: {$sid} %0D%0A%0D%0A\">The Technology Committee would love to know what you think</a>.";



// Load the Event Files
foreach ($eventFileList as $ef) {
	$id = substr($ef, 0, -5);
	$eventList[$id] = json_decode(file_get_contents("events/" . $ef));
	$eventList[$id]->id = intval($id);
}

YouTubeLiveEmbed::setApiKey($credentials->YouTube);


// Create default HandlerStack, add cache to the stack.
$stack = HandlerStack::create();
$stack->push(
	new CacheMiddleware(
		new GreedyCacheStrategy(
			new DoctrineCacheStorage(
				new FilesystemCache('../tmp/')
			),
			10 // the TTL in seconds
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

//// YouTube: Just in case there aren't any current live streams...
//	if ( isset( $_GET['test'] ) && ( intval( $_GET['test'] ) & 1 ) ) { // test video from California Academy of Natural Sciences
//		$ytle               = new YouTubeLiveEmbed( 'UCZvXaNYIcapCEcaJe_2cP7A' );
//		$ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
//		$ytV                = $ytle->videos();
//	}
} catch (GuzzleHttp\Exception\ClientException $e) {
	$ytV = [];
	$r->msg[] = "<p>There seems to have been an issue querying the YouTube API.  Apologies.</p>";
}

//
//// Facebook Query
//if (isset($_GET['test']) && (intval($_GET['test']) & 1)) { // test video from... wherever convenient
//	$fbReq = $client->request( 'GET', "https://graph.facebook.com/v2.11/News18TamilNadu/videos?fields=live_status%2Ctitle&limit=10&access_token=" . $credentials->Facebook );
//} else {
//	$fbReq = $client->request( 'GET', "https://graph.facebook.com/v2.11/tenth/videos?fields=live_status%2Ctitle&limit=10&access_token=" . $credentials->Facebook );
//}
//$fblObj             = json_decode($fbReq->getBody());
//$facebookSrcObjects = [];
//$facebookTitle      = "Facebook Live";
//foreach ($fblObj->data as $video) {
//	if (isset($video->live_status) && $video->live_status === "LIVE") {
//		$facebookSrcObjects[] = (object)[
//			'type' => 'fbl',
//			'language' => 'en-us',
//			'id' => "fbl-" . $video->id,
//			'url' => "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fpages%2Fvideos%2F" . $video->id . "%2F&mute=0&autoplay=1"
//		];
//		if (isset($video->title)) {
//			$facebookTitle = $video->title;
//		}
//	}
//}


// SermonAudio Query
try { // this catches SermonAudio Server errors (which, apparently, happen sometimes).
	$sourceID = 'tenth';

// URL queried to determine *if* the webcast is online.  Currently, this ONLY determines *whether* the stream is online.
	$sa_curl = $client->request( 'GET', 'https://embed.sermonaudio.com/button/l/' . $sourceID . '/' )->getBody();

	$sa = (object) [
		'isLive'      => ( strpos( $sa_curl, "Webcast Offline" ) === false ),
		'videoIfrUrl' => '//embed.sermonaudio.com/player/l/' . $sourceID . '/?autoplay=true',
		'audioIfrUrl' => "//embed.sermonaudio.com/player/l/" . $sourceID . "/?autoplay=true&quality=audio",
	];
} catch (GuzzleHttp\Exception\ClientException $e) {
	$sa = (object) [
		'isLive'      => false,
		'videoIfrUrl' => "//embed.sermonaudio.com/player/l/" . $sourceID . "/?autoplay=true",
		'audioIfrUrl' => "//embed.sermonaudio.com/player/l/" . $sourceID . "/?autoplay=true&quality=audio",
	];
	$r->msg[] = "<p>There seems to have been an issue querying the SermonAudio API.  Apologies.</p>";
}


// Match events to streams.
foreach ($eventList as &$e) {
	$e->active = false;
	foreach ($e->sources as &$s) {
		// iterating on every source.

		// check to see if YouTube is Live
		if ($s->type === "yt") {
			foreach ( $ytV as &$v ) {
				if ( $s->id === "yt-" . $v->id ) {
					$e->active = true;
					$s->active = true;
					$r->live[] = $e;
					$v->used   = true;
					break;
				}
			}
			unset($v);
		}

//		// check to see if facebook is live
//		if ($s->type === "fbl") {
//			foreach ( $facebookSrcObjects as &$v ) {
//				if ( $s->id === "fbl-" . $v->id ) {
//					$e->active = true;
//					$s->active = true;
//					$r->live[] = $e;
//					$v->used   = true;
//					break;
//				}
//			}
//			unset($v);
//		}
	}
	unset($s);

	// event isn't live, so add to archive list.
	if (!$e->active)
		$r->archive[] = $e;
}
unset($e);

// Assign SermonAudio to an event (or create one if one isn't available)
$saIsAssigned = false;
if ($sa->isLive && count($r->live) > 0) {
	foreach($r->live as $e) {
		foreach ($e->sources as $v) {
			if ($v->type === "sa-vid" || $v->type === "sa-aud") {
				$saIsAssigned = true;
				break 2;
			}
		}
		unset($v);
	}
	unset($e);
}

//// Create Events for SermonAudio streams that don't belong to an event.
//if ($sa->isLive && !$saIsAssigned) {
//	$sources[] = (object) [
//		'type'     => 'sa-vid',
//		'language' => 'en-us',
//		'id'       => "sa-vid",
//		'active'   => true,
//		'url'      => $sa->videoIfrUrl,
//	];
//	$sources[] = (object) [
//		'type'     => 'sa-aud',
//		'language' => 'en-us',
//		'id'       => "sa-aud",
//		'active'   => true,
//		'url'      => $sa->audioIfrUrl,
//	];
//	$r->live[] = (object) [
//		'name'        => "Livestream",
//		'priority'    => 1,
//		'id'          => "ev-sa",
//		'description' => "",
//		'sources'     => $sources,
//		'attachments' => []
//	];
//}
//
//
//// Create Events for YouTube streams that don't belong to an event.
//foreach ($ytV as $v) {
//	if ( !isset( $v->used ) ) {
//		$r->live[] = (object) [
//			'name'        => $v->title,
//			'priority'    => 1,
//			'id'          => "ev-yt" . $v->id,
//			'description' => $v->description,
//			'sources'     => [
//				(object) [
//					'type'     => 'yt',
//					'language' => 'en-us',
//					'id'       => "yt-" . $v->id,
//					'active'   => true,
//					'url'      => "//www.youtube.com/embed/" . $v->id . "?autoplay=1&rel=0&showinfo=0&color=white",
//					'thumb'    => $v->thumb_high
//				]
//			],
//			'attachments' => []
//		];
//	}
//}
//unset($v);
//
//// Create Events for Facebook streams that don't belong to an event.
//foreach ($facebookSrcObjects as $v) {
//	if ( !isset( $v->used ) ) {
//		$r->live[] = (object) [
//			'name'        => $facebookTitle,
//			'priority'    => 1,
//			'id'          => "ev-fbl" . substr($v->id,4),
//			'description' => "",
//			'sources'     => [$v],
//			'attachments' => []
//		];
//	}
//}
//unset($v);


// Source Validation (Live)
$includeError3 = false;

foreach ($r->live as &$e) {
	foreach ($e->sources as $sk => $s) {
		$valid = true;
		switch ($s->type) {
			case "yt":
//				if (!isset($s->active)) {
//					$valid = false;
//					break;
//				}
				if ($_SERVER['HTTP_USER_AGENT'] === 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko') {
					$valid = false;
					$includeError3 = true;
					break;
				}
				break;

			case "fbl":
				if (!isset($s->active))
					$valid = false;
				break;
		}
		if (!$valid) {
			unset( $e->sources[ $sk ] );
		}
	}
	unset($s, $sk);
}
unset($e);

if ($includeError3) {
	$r->msg[] = "<span style=\"color: #f00;\">Please note that some streams are available, but won't work with Internet Explorer on Windows 7.  Please consider using a different browser.</span>";
}

// Source Validation (Archive)
foreach ($r->archive as &$e) {
	foreach ($e->sources as $sk => $s) {
		$valid = true;
		switch ($s->type) {
			case "sa-aud":
			case "sa-vid":
				$valid = false;
				break;
		}
		if (!$valid) {
			unset( $e->sources[ $sk ] );
		}
	}
	unset($s, $sk);
}
unset($e);

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
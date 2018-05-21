<?php

/** The purpose of this script is to determine which streams are currently live, and save that information
 * to the file liveNow.json.  It's just an array of the currently-live IDs  */


require_once '../vendor/autoload.php';

use \jkrrv\YouTubeLiveEmbed;
use \GuzzleHttp\Client;
use \GuzzleHttp\HandlerStack;
use \Kevinrob\GuzzleCache\CacheMiddleware;
use Kevinrob\GuzzleCache\Strategy\GreedyCacheStrategy;
use Kevinrob\GuzzleCache\Storage\DoctrineCacheStorage;
use Doctrine\Common\Cache\FilesystemCache;


// load API credentials
$credentials = json_decode(file_get_contents('../credentials.json'));


// set the YouTube API Key
YouTubeLiveEmbed::setApiKey($credentials->YouTube);


function doCron()
{

// Create the array that will become the list of live streams
    $list = [];


// Create default HandlerStack, add cache to the stack.
    $stack = HandlerStack::create();
    $stack->push(
        new CacheMiddleware(
            new GreedyCacheStrategy(
                new DoctrineCacheStorage(
                    new FilesystemCache('../tmp/')
                ),
                9 // the TTL in seconds
            )
        ),
        'greedy-cache'
    );
    $client = new Client(['handler' => $stack]);


// YouTube Query
    try { // this catches quota exceeding errors.
        $ytle = new YouTubeLiveEmbed('UC_GR2sUKyKPiULviFLvPDQg');
        $ytle->guzzleClient = $client; // replace guzzle client with this one, with the handler option
        $ytV = $ytle->videos();

        foreach ($ytV as $v) {
//        $list[] = (object)[
//            "type"  => "yt",
//            "id"    => "yt-" . $v->id,
//            "url"   => "//www.youtube.com/embed/" . $v->id . "?autoplay=1&rel=0&showinfo=0&color=white"
//        ];
            $list[] = "yt-" . $v->id;
            echo "  yt-" . $v->id . "\n";
        }
        unset($v);
    } catch (GuzzleHttp\Exception\ClientException $e) {
        echo $e->getMessage();
        // TODO error reporting (has only been noticed on account of quota issues)
    } catch (RuntimeException $e) {
        // no network connection, probably.
    }

//    $list[] = "yt-M6BjQCSD1v0"; // TODO refactor so this absurdity isn't necessary


// Facebook Query
    $facebookSrcObjects = [];
    try {
        if (isset($_GET['test']) && (intval($_GET['test']) & 1)) { // test video from... wherever convenient
            $fbReq = $client->request('GET', "https://graph.facebook.com/v2.11/News18TamilNadu/videos?fields=live_status%2Ctitle&limit=10&access_token=" . $credentials->Facebook);
        } else {
            $fbReq = $client->request('GET', "https://graph.facebook.com/v2.11/tenth/videos?fields=live_status%2Ctitle&limit=10&access_token=" . $credentials->Facebook);
        }
        $fblObj = json_decode($fbReq->getBody());
        foreach ($fblObj->data as $v) {
            if (isset($v->live_status) && $v->live_status === "LIVE") {
//            $list[] = (object)[
//                'type' => 'fbl',
//                'id' => "fbl-" . $v->id,
//                'url' => "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fpages%2Fvideos%2F" . $v->id . "%2F&mute=0&autoplay=1"
//            ];
                $list[] = "fbl-" . $v->id;
            }
        }
    } catch (\GuzzleHttp\Exception\ClientException  $e) {
        // TODO error reporting (hasn't been noticed as happening, but hypothetically could.)
    } catch (RuntimeException $e) {
        // no network connection, probably
    } catch (GuzzleException $e) {

    }


// SermonAudio Query
    try { // this catches SermonAudio Server errors (which, apparently, happen sometimes).
        $sourceID = 'tenth';
        $sa_curl = 'Webcast Offline';

        try {
            // URL queried to determine *if* the webcast is online.  Currently, this ONLY determines *whether* the stream is online.
            $sa_curl = $client->request('GET', 'https://embed.sermonaudio.com/button/l/' . $sourceID . '/')->getBody();
        } catch (RuntimeException $e) {
            // no network connection, probably
        }


        if (strpos($sa_curl, "Webcast Offline") === false) {
//        $list[] = (object)[
//            'type' => 'sa-vid',
//            'id' => "sa-vid",
//            'url' => "//embed.sermonaudio.com/player/l/tenth/?autoplay=true"
//        ];
            $list[] = "sa-vid";

//        $list[] = (object)[
//            'type' => 'sa-aud',
//            'id' => "sa-aud",
//            'url' => "//embed.sermonaudio.com/player/l/tenth/?autoplay=true&quality=audio"
//        ];
            $list[] = "sa-aud";
        }
    } catch (GuzzleHttp\Exception\ClientException $e) {
        // TODO error reporting (SA returns server errors reasonably often)
    }


    file_put_contents('liveNow.json', json_encode($list));

    echo "Success\n";

    ob_flush();
    flush();
}

set_time_limit(60);
doCron();
sleep(9);
doCron();
sleep(9);
doCron();
sleep(9);
doCron();
sleep(9);
doCron();
sleep(9);
doCron();
sleep(9);
doCron();


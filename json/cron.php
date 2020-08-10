<?php

/** The purpose of this script is to determine which streams are currently live, and save that information
 * to the livestream database.   */

//die();

require_once '../vendor/autoload.php';
require_once '../../liveDb.php';

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

    global $credentials;
    global $_db;
    global $tz;

// Create the array that will become the list of runs live now
    $runsLiveNow = [];

// Prep query to update stream sources
    $updateStreamSrcStatus = $_db->prepare("UPDATE StreamSources SET status = :status WHERE id = :srcId");


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

        $selYtSrcByProvId = $_db->prepare("SELECT src.id as srcId, src.run as runId, src.status as runStatus FROM StreamSources AS src WHERE src.provider = 'yt' AND src.providerId = :providerId");
        $selLiveYtSrc = $_db->prepare("SELECT src.id as srcId FROM StreamSources AS src WHERE src.provider = 'yt' AND src.status = 2");
        $selLiveYtSrc->execute();

        $ytLiveSrcLiveNow = [];
        foreach ($ytV as $v) { // each current live stream
            $selYtSrcByProvId->execute(['providerId' => $v->id]);
            $liveSrc = $selYtSrcByProvId->fetch(PDO::FETCH_OBJ);

            // update run status
            if ($liveSrc->status !== 2) {
                $updateStreamSrcStatus->execute(['status' => 2, 'srcId' => $liveSrc->srcId]);
            }

            $ytLiveSrcLiveNow[] = $liveSrc->srcId;

            // add to run array
            if (!in_array($liveSrc->runId, $runsLiveNow)) {
                $runsLiveNow[] = $liveSrc->runId;
            }
        }
        unset($v);

        while ($liveListedSrcId = $selLiveYtSrc->fetchColumn(0)) { // foreach source listed as live
            if (!in_array($liveListedSrcId, $ytLiveSrcLiveNow)) { // if it's not actually live
                $updateStreamSrcStatus->execute(['status' => 3, 'srcId' => $liveListedSrcId]);
            }
        }


    } catch (GuzzleHttp\Exception\ClientException $e) {
        echo $e->getMessage();
        // TODO error reporting (has only been noticed on account of quota issues)
    } catch (RuntimeException $e) {
        // no network connection, probably.
    }



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
            $runsLiveNow[] = (object)[
                'provider' => 'fbl',
                'providerId' => $v->id,
//                'url' => "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fpages%2Fvideos%2F" . $v->id . "%2F&mute=0&autoplay=1"
            ];
            }
        }
    } catch (\GuzzleHttp\Exception\ClientException  $e) {
        // TODO error reporting (hasn't been noticed as happening, but hypothetically could.)
    } catch (RuntimeException $e) {
        // no network connection, probably
    } catch (GuzzleException $e) {

    }




// SermonAudio Query
    $sermonAudioIsLive = false;
    try { // this catches SermonAudio Server errors (which, apparently, happen sometimes).
        $channelId = 'tenth';
        $sa_curl = 'Webcast Offline';

        try {
            // URL queried to determine *if* the webcast is online.  Currently, this ONLY determines *whether* the stream is online.
            $sa_curl = $client->request('GET', 'https://embed.sermonaudio.com/button/l/' . $channelId . '/')->getBody();
        } catch (RuntimeException $e) {
            echo "Could not connect to SermonAudio: " . $e . "\n";
            // no network connection, probably
        }

        $selLiveSaSrc = $_db->prepare("SELECT src.id as srcId, src.run as runId FROM StreamSources AS src WHERE src.provider = 'sa' AND src.status = 2");
        $selLiveSaSrc->execute();

        if (strpos($sa_curl, "Webcast Offline") === false) {  // stream is live.
            echo "\nSermonAudio is live.";
            $liveSrc = $selLiveSaSrc->fetch(PDO::FETCH_OBJ);

            if ($liveSrc === false) { // there is no stream already marked as live.  Runs will NOT be marked as live until the following execution.
                // find the next likely streams to be live now.
                $dtStart = (new DateTime())->sub(new DateInterval("PT1H"))->setTimezone($tz);
                $dtEnd = (new DateTime())->add(new DateInterval("PT1H"))->setTimezone($tz);
                $selPendingSaSrc = $_db->prepare("SELECT src.id as srcId FROM StreamSources AS src LEFT JOIN WorshipRun AS run ON src.run = run.id WHERE run.startDT BETWEEN :dtStart AND :dtEnd AND src.provider = 'sa' AND src.status = 1");
                $selPendingSaSrc->execute(['dtStart' => $dtStart->format('Y-m-d H:i:s'), 'dtEnd' => $dtEnd->format('Y-m-d H:i:s')]);
                while ($liveRuns = $selPendingSaSrc->fetchColumn(0)) {
                    // set status to Live
                    $updateStreamSrcStatus->execute(['status' => 2, 'srcId' => $liveRuns]);
                }
            } else { // there is a stream already marked as running
                do  {
                    if (!in_array($liveSrc->runId, $runsLiveNow)) {
                        $runsLiveNow[] = $liveSrc->runId;
                    }
                } while ($liveSrc = $selLiveSaSrc->fetch(PDO::FETCH_OBJ));
            }


        } else { // stream is not live.
            echo "\nSermonAudio is not live. ";
            $liveSrc = $selLiveSaSrc->fetchColumn(0);

            if ($liveSrc !== false) { // there is a stream marked as running
                do {
                    $updateStreamSrcStatus->execute(['status' => 3, 'srcId' => $liveSrc]);
                } while ($liveSrc = $selLiveSaSrc->fetchColumn(0));
            }
        }
    } catch (GuzzleHttp\Exception\ClientException $e) {
        echo "SermonAudio Request Failed";
        // TODO error reporting (SA returns server errors reasonably often)
    }
    
    
// Update Runs
    $selLiveRuns = $_db->prepare("SELECT run.id as runId FROM WorshipRun AS run WHERE run.status = 2");
    $selLiveRuns->execute();
    $updateRunStatus = $_db->prepare("UPDATE WorshipRun SET status = :status WHERE id = :runId");

    // mark any false live runs as completed. 
    while ($liveRunId = $selLiveRuns->fetchColumn(0)) {
        if (!in_array($liveRunId, $runsLiveNow)) { // if no longer live, remove.
            $updateRunStatus->execute(['status' => 3, 'runId' => $liveRunId]);
            echo "Marking Run $liveRunId as no longer live.";
        } else { // if still live, remove from array, so update isn't called in next section.
            unset($runsLiveNow[array_search($liveRunId, $runsLiveNow)]);
        }
    }

    foreach ($runsLiveNow as $liveRunId) {
        $updateRunStatus->execute(['status' => 2, 'runId' => $liveRunId]);
        echo "Marking Run $liveRunId as live.";
    }

    ob_flush();
    flush();
}

set_time_limit(60);
doCron();
<?php

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


// Load the list of Live Now
$liveNow = json_decode(file_get_contents("liveNow.json"));


// Load the Event Files
foreach ($eventFileList as $ef) {
	$id = intval(substr($ef, 0, -5));
	$e = json_decode(file_get_contents("events/" . $ef));

    $e->active = false;
    $e->id = $id;

    // determine if the event is live
	foreach ($e->sources as &$s) {
	    $s->active = false;

	    if (in_array($s->id, $liveNow)) {
            $s->active = true;
            if($s->type !== "sa-aud" && $s->type !== "sa-vid") {
                $e->active = true;
            }
        }
    }

    if ($e->active) {
	    $r->live[] = $e;
    } else {
	    $r->archive[] = $e;
    }
}
unset ($e, $s);


// Source Validation (Live)
$includeError3 = false;

foreach ($r->live as &$e) {
	foreach ($e->sources as $sk => $s) {
		$valid = isset($s->active) && !!$s->active;
		if ($valid) {
            switch ($s->type) {
                case "yt":
                    if ($_SERVER['HTTP_USER_AGENT'] === 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko') {
                        $valid = false;
                        $includeError3 = true;
                        break;
                    }
                    break;
            }
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
unset($e, $valid);

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
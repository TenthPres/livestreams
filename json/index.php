<?php

error_reporting(E_ALL);
ini_set('display_errors', 'On');

// Headers

if (isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    if (strpos($origin, 'tenth.', 7) === false)
        $origin = "https://www.tenth.org";
    header("Access-Control-Allow-Origin: " . $origin);
}
header("Content-Type: application/json");
header("Access-Control-Allow-Credentials: true");
header_remove('X-Powered-By');


if (isset($_GET['test'])) {
    echo file_get_contents("test.json");
    return;
}

if (isset($_COOKIE['kurtz'])) {
    $sid = $_COOKIE['kurtz'];
} else {
    $sid = null;
}

require_once  '../../liveDb.php';



$genQuery = $_db->prepare("SELECT 
       WorshipRun.id as r_id, 
       WorshipRun.startDT as r_startDT, 
       WorshipRun.status as r_status, 
       WorshipRun.name as r_name, 
       WorshipRun.description as r_description, 
       WorshipOrders.id as o_id, 
       WorshipOrders.name as o_name, 
       WorshipOrders.type as o_type, 
       WorshipOrders.description as o_description,
       WorshipOrders.priority as o_priority,
       WorshipOrders.elementsHtml IS NOT NULL as o_hasHtml,
       WorshipOrders.elementsJson IS NOT NULL as o_hasJson
FROM main.WorshipRun LEFT JOIN main.WorshipOrders ON WorshipRun.worshipOrder = WorshipOrders.id 
WHERE WorshipRun.status = :status AND WorshipRun.id != :run ORDER BY abs(strftime('%s',datetime(WorshipRun.startDT)) - strftime('%s','now')), WorshipRun.id DESC LIMIT :lim");

$uniQuery = $_db->prepare("SELECT 
       WorshipRun.id as r_id, 
       WorshipRun.startDT as r_startDT, 
       WorshipRun.status as r_status, 
       WorshipRun.name as r_name,
       WorshipRun.description as r_description, 
       WorshipOrders.id as o_id, 
       WorshipOrders.name as o_name, 
       WorshipOrders.type as o_type, 
       WorshipOrders.description as o_description,
       WorshipOrders.priority as o_priority,
       WorshipOrders.elementsHtml IS NOT NULL as o_hasHtml,
       WorshipOrders.elementsJson IS NOT NULL as o_hasJson
FROM main.WorshipRun LEFT JOIN main.WorshipOrders ON WorshipRun.worshipOrder = WorshipOrders.id 
WHERE WorshipRun.id = :run ORDER BY WorshipRun.startDT");

$strQuery = $_db->prepare("SELECT
       StreamSources.id as s_id,
       StreamSources.provider as s_provider,
       StreamSources.providerId as s_providerId,
       StreamSources.status as s_status
FROM main.StreamSources
WHERE StreamSources.run = :run ORDER BY abs(s_status - 2), s_id ASC");

$r = (object)[
    'live' => [],
    'archive' => [],
    'upcoming' => [],
    'messages' => [
        "Find the Order of Worship, Scripture, and Hymns below the video on this page.",
        "Thank you for joining us. <a style=\"background-color: transparent;\" href=\"mailto:techcmte@tenth.org?subject=Livestream Feedback&body=%0D%0A%0D%0A(please keep this identifier in your email) %0D%0ASI: {$sid} %0D%0A%0D%0A\">Let us know what you think</a>."
    ]
];

function statusIntToString($int) {
    switch (intval($int)) {
        case 1:
            return "SCHEDULED";
        case 2:
            return "LIVE";
        case 3:
            return "COMPLETED";
    }
    RETURN "UNKNOWN";
}


function addRunToArray($run, &$array) {

    global $strQuery;
    global $tz;

    $strQuery->execute(['run' => $run['r_id']]);

    $sources = [];
    while ($src = $strQuery->fetch(PDO::FETCH_ASSOC)) {

        $src['s_status'] = intval($src['s_status']);

        // skip SermonAudio sources that aren't currently live
        if ($src['s_provider'] === "sa" && $src['s_status'] !== 2)
            continue;

        $sources[] = [
            "_id" => intval($src['s_id']),
            "provider" => $src['s_provider'],
            "providerId" => $src['s_providerId'],
            "status" => statusIntToString($src['s_status'])
        ];
    }

    $startDT = new \DateTime($run['r_startDT'], $tz);
    $array[] = [
        "_id" => intval($run['r_id']),
        "name" => runName($run),
        "priority" => intval($run['o_priority']),
        "description" => ($run['r_description'] ? $run['r_description'] : $run['o_description']),
        "startDT_formatted" => $startDT->format("D, j M Y ⋅ g:ia"),
        "status" => statusIntToString($run['r_status']),
        "sources" => $sources,
        "order" => [
            "_id" => intval($run['o_id']),
            "hasHtml" => !!$run['o_hasHtml'],
            "hasJson" => !!$run['o_hasJson']
        ],
    ];
}

function runName($run) {
    if ($run['r_name'] !== "" && $run['r_name'] !== null)
        return $run['r_name'];

    if ($run['o_name'] !== "" && $run['o_name'] !== null)
        return $run['o_name'];

    switch (intval($run['o_type'])) {
        case 1:
            return "Morning Worship Service";

        case 2:
            return "Evening Worship Service";

        case 3:
            return "Internationals Worship Service";

        case 6:
            return "Evening Prayers";
    }

    return "";
}

$requestedRun = 0;
if (isset($_GET['r'])) {
    $requestedRun = intval($_GET['r']);
    $uniQuery->execute(['run' => $requestedRun]);
    while ($run = $uniQuery->fetch(PDO::FETCH_ASSOC)) {
        switch($run['r_status']) {
            case 1:
                addRunToArray($run, $r->upcoming);
                continue 2;
            case 2:
                addRunToArray($run, $r->live);
                continue 2;
            case 3:
                addRunToArray($run, $r->archive);
                continue 2;
        }
    }
}

$limit = 10;

$genQuery->execute(['status' => 2, 'run' => $requestedRun, 'lim' => $limit]);
while ($run = $genQuery->fetch(PDO::FETCH_ASSOC)) {
    addRunToArray($run, $r->live);
    $limit--;
}

$genQuery->execute(['status' => 1, 'run' => $requestedRun, 'lim' => min(3, $limit)]);
while ($run = $genQuery->fetch(PDO::FETCH_ASSOC)) {
    addRunToArray($run, $r->upcoming);
    $limit--;
}

$genQuery->execute(['status' => 3, 'run' => $requestedRun, 'lim' => $limit]);
while ($run = $genQuery->fetch(PDO::FETCH_ASSOC)) {
    addRunToArray($run, $r->archive);
    $limit--;
}


echo json_encode($r);


//todo restore analytics

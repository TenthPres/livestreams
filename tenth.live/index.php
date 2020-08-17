<?php

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = explode('/', $path, 3);


$requestedRun = intval($path[1]);


if (strpos($_SERVER['HTTP_USER_AGENT'], "facebookexternalhit") === false && strpos($_SERVER['HTTP_USER_AGENT'], "Twitterbot") === false) {
    header( "Location: https://www.tenth.org/livestream?event=" . $requestedRun );
    die();
}


require_once '../../liveDb.php';



if ($requestedRun < 100) { // no specific ID is given
    $detailsQuery = $_db->prepare("
        SELECT WR.startDT as startDT,
               WR.id as WR_id,
               WR.name as WR_name,
               WO.name as WO_name,
               WO.type as type,
               WR.description as WR_description,
               WO.description as WO_description,
               SS.providerId as ytId
               FROM WorshipRun AS WR 
                          JOIN WorshipOrders AS WO on WR.worshipOrder = WO.id 
                          LEFT JOIN StreamSources AS SS on WR.id = SS.run and SS.provider = 'yt'
               WHERE WR.status = 2");
    $detailsQuery->execute();
    if (!$details = $detailsQuery->fetch(PDO::FETCH_OBJ)) {
        $requestedRun = 0;
    } else {
        $requestedRun = intval($details->WR_id);
    }

} else { // specific id is given
    $detailsQuery = $_db->prepare("
        SELECT WR.startDT as startDT,
               WR.name as WR_name,
               WO.name as WO_name,
               WO.type as type,
               WR.description as WR_description,
               WO.description as WO_description,
               SS.providerId as ytId
               FROM WorshipRun AS WR 
                          JOIN WorshipOrders AS WO on WR.worshipOrder = WO.id 
                          LEFT JOIN StreamSources AS SS on WR.id = SS.run and SS.provider = 'yt'
               WHERE WR.id = :requestedRun");
    $detailsQuery->execute(['requestedRun' => $requestedRun]);
    if (!$details = $detailsQuery->fetch(PDO::FETCH_OBJ)) {
        $requestedRun = 0;
    }
}



// description info
$combinedDescription = "";
if ($requestedRun !== 0) {
    try {
        $combinedDescription = (new DateTime($details->startDT))->format("D, j M Y &#8901; g:ia") . " &#8901; ";
    } catch (Exception $ex) {
    }


    if ($details->WR_description !== null) {
        $combinedDescription .= $details->WR_description;
    } else {
        $combinedDescription .= $details->WO_description;
    }

    $combinedDescription = htmlspecialchars($combinedDescription);
} else {
    $combinedDescription = "Join our worship services online.";
}

// Image URL
$socialImageUrl = null;
if ($details->ytId !== null) {
    $socialImageUrl = "https://img.youtube.com/vi/" . $details->ytId . "/0.jpg";
} else {
    $socialImageUrl = "https://d1nwfrzxhi18dp.cloudfront.net/sites/55df3b36200cc96eb3000006/theme/images/live/Three-Panel-Pulpit-View_4-Composite.jpg";
}

// title
$name = typeIntToFullName($details->type);
if ($details->WR_name !== null && $details->WO_name !== "") {
    $name = $details->WR_name;
} else if($details->WO_name !== null && $details->WO_name !== "") {
    $name = $details->WO_name;
}
$name = htmlspecialchars($name);



if ($requestedRun === 0)
    $requestedRun = "";

?>

<html prefix="og: http://ogp.me/ns#">
<head>
	<title>Tenth Livestream</title>
	<link rel="canonical" href="https://tenth.live/<?php echo $requestedRun; ?>">
	<meta name="description" content="Tenth Presbyterian Church<?php if ($name !== "") {echo " // "; } ?><?php echo $name ?>">
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:site" content="@tenthpres">
	<meta name="twitter:title" content="Tenth Livestream<?php if ($name !== "") {echo " | "; } ?><?php echo $name ?>">
	<meta name="twitter:description" content="<?php echo $combinedDescription; ?>">
	<meta name="twitter:image" content="<?php echo $socialImageUrl ?>">
	<meta property="og:url" content="https://tenth.live/<?php echo $requestedRun; ?>">
	<meta property="og:title" content="Tenth Livestream<?php if ($name !== "") {echo " | "; } ?><?php echo $name ?>">
	<meta property="og:image" content="<?php echo $socialImageUrl ?>">
	<meta property="og:image:width" content="1200">
	<meta property="og:image:height" content="630">
	<meta property="og:description" content="<?php echo $combinedDescription; ?>">
	<meta property="og:site_name" content="Tenth Presbyterian Church">
	<meta property="og:type" content="website">
	<meta property="fb:admins" content="590301109">
	<meta property="fb:app_id" content="471343559743264">
	<meta name="theme-color" content="#49917b">
</head>
</html>

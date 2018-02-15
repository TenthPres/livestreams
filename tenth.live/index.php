<?php

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = explode('/', $path, 3);

$desiredEvent = "";
$currentEvent = 0;
$e = new StdClass();
if (isset($path[1]) && $path[1] !== "" && file_exists("../json/events/" . $path[1] . ".json")) {
	$desiredEvent = intval($path[1]);
	$e = json_decode(file_get_contents("../json/events/" . $desiredEvent . ".json"));
}

// check to see if absent fields can be replaced with substitutes
if (!isset($e->summary) && isset($e->description)) {
    $e->summary = $e->description;
}

// Use defaults for imperative fields
$requiredFields = ["socialImageUrl", "summary", "name"];
foreach ($requiredFields as $rf) {
	$eDefault = null;
	if (!isset($e->$rf)) {
		if ($eDefault === null) {
			$eDefault = json_decode(file_get_contents("../json/events/default.json"));
		}
		$e->$rf = $eDefault->$rf;
	}
}
unset($eDefault);



if (strpos($_SERVER['HTTP_USER_AGENT'], "facebookexternalhit") === false && strpos($_SERVER['HTTP_USER_AGENT'], "Twitterbot") === false) {
	if ($desiredEvent === 0) {
		header( "Location: https://www.tenth.org/livestream-beta" );
	} else {
		header( "Location: https://www.tenth.org/livestream-beta?event=" . $desiredEvent );
	}
	die();
}

$combinedDescription = "";
if (isset($e->startDT_formatted) && $desiredEvent !== $currentEvent)
	$combinedDescription .= ($e->startDT_formatted . " &#8901; ");
if (isset($e->subtitle))
	$combinedDescription .= ($e->subtitle . " &#8901; ");
if (isset($e->summary))
	$combinedDescription .= ($e->summary);

$combinedDescription = htmlspecialchars($combinedDescription);
$e->name = htmlspecialchars($e->name);

?>

<html prefix="og: http://ogp.me/ns#">
<head>
	<title>Tenth Livestream</title>
	<link rel="canonical" href="https://tenth.live/<?php echo $desiredEvent; ?>">
	<meta name="description" content="Tenth Presbyterian Church // Livestream: <?php echo $e->name ?>">
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:site" content="@tenthpres">
	<meta name="twitter:title" content="Tenth Livestream | <?php echo $e->name ?>">
	<meta name="twitter:description" content="<?php echo $combinedDescription; ?>">
	<meta name="twitter:image" content="<?php echo $e->socialImageUrl ?>">
	<meta property="og:url" content="https://tenth.live/<?php echo $desiredEvent; ?>">
	<meta property="og:title" content="Tenth Livestream | <?php echo $e->name ?>">
	<meta property="og:image" content="<?php echo $e->socialImageUrl ?>">
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

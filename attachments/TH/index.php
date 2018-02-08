<?php

$htmlSnip = file_get_contents("https://hymnary.org/ajax/pagescans/TH1990/" . $_GET['h']);

preg_match_all("/page\/(\d+)/", $htmlSnip, $matches);

$origin = $_SERVER['HTTP_ORIGIN'];
if (strpos($origin, 'tenth.', 7) === false)
	$origin = "https://www.tenth.org";
header("Access-Control-Allow-Origin: " . $origin);
header("Access-Control-Allow-Credentials: true");
header_remove('X-Powered-By');
foreach ($matches[1] as $m) {
	echo "<img src=\"https://hymnary.org/page/fetch/TH1990/{$m}\" />";
}

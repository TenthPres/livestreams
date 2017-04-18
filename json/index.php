<?php

require_once '../vendor/autoload.php';

use \jkrrv\YouTubeLiveEmbed;

YouTubeLiveEmbed::setApiKey('AIzaSyChOgE1uQkFhxo1xOOdhlSCscmTvR2YcCk');

$ytle = new YouTubeLiveEmbed('UC_GR2sUKyKPiULviFLvPDQg');
$ytV= $ytle->videos();

$r = (object)[];
$r->live = (object)[];
$r->live->youtube = [];


foreach($ytV as $v) {
	$r->live->youtube[] = "//www.youtube.com/embed/" . $v->id . "?autoplay=1&rel=0&showinfo=0";
}

$r->live->youtube[] = "//www.youtube.com/embed/eQQ9hxGbZgs?autoplay=1&rel=0&showinfo=0";

echo json_encode($r);
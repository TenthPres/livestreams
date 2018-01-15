<?php

require_once '../../vendor/autoload.php';

use \GuzzleHttp\Client;
use \GuzzleHttp\HandlerStack;
use \Kevinrob\GuzzleCache\CacheMiddleware;
use Kevinrob\GuzzleCache\Strategy\GreedyCacheStrategy;
use Kevinrob\GuzzleCache\Storage\DoctrineCacheStorage;
use Doctrine\Common\Cache\FilesystemCache;

$credentials = json_decode(file_get_contents('../../credentials.json'));

// Create default HandlerStack, add cache to the stack.
$stack = HandlerStack::create();
$stack->push(
	new CacheMiddleware(
		new GreedyCacheStrategy(
			new DoctrineCacheStorage(
				new FilesystemCache('../../tmp/')
			),
			3000 // the TTL in seconds
		)
	),
	'greedy-cache'
);

$client = new Client(['handler' => $stack]);

$esvReq = $client->request( 'GET', "https://api.esv.org/v3/passage/html/?q={$_GET['q']}&include-css-link=false&inline-styles=false&wrapping-div=false&include-book-titles=false&include-passage-references=false&include-verse-anchors=false&include-chapter-numbers=true&include-first-verse-numbers=false&include-verse-numbers=true&include-footnotes=true&include-footnote-body=true&include-crossrefs=true&include-short-copyright=false&include-copyright=true", [
	'headers' => [
		"Authorization" => $credentials->ESV
	]
]);

header("Access-Control-Allow-Origin: https://www.tenth.org");
header("Access-Control-Allow-Credentials: true");
header_remove('X-Powered-By');
foreach (json_decode($esvReq->getBody())->passages as $p) {
	echo $p;
}

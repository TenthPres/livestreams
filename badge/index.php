<?php

$body = file_get_contents("https://www.tenth.org/");

echo str_replace("<head>", "<head><link rel=\"stylesheet\" type=\"text/css\" href=\"badge.min.css\"><script src=\"../script.min.js\"></script>", $body);

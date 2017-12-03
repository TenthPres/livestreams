<?php

$body = file_get_contents("https://www.tenth.org/");

echo str_replace("<head>", "<head><script src=\"badge.min.js\" defer></script>", $body);


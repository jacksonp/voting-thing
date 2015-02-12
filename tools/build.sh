#!/usr/bin/env bash

cat app/poll.js app/public/js/all.js > app/public/js/vt.min.js



cp app/public/index.html vt/www/
rsync app/public/js/* vt/www/js/
rsync -r app/public/css/* vt/www/css/
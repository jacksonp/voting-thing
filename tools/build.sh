#!/usr/bin/env bash

cat css/jquery.mobile-1.4.5.min.css css/vt.css > www/css/all.min.css


# The <(echo) is to add a needed newline after jquery mobile.
cat \
  js/jquery-2.1.3.min.js \
  js/jquery.mobile-1.4.5.min.js <(echo) \
  bower_components/knockout/dist/knockout.js \
  app/node_modules/socket.io/node_modules/socket.io-client/socket.io.js \
  app/poll.js \
  js/person.js \
  js/room.js \
  js/vt.js \
> www/js/all.min.js



cp www/index.html vt/www/
rsync www/js/* vt/www/js/
rsync -r www/css/* vt/www/css/

sed -i "/APP_EXCLUDE_START/,/APP_EXCLUDE_END/d" vt/www/js/all.min.js
sed -i "/WEB_EXCLUDE_START/,/WEB_EXCLUDE_END/d" www/js/all.min.js

sed -i "/APP_EXCLUDE_START/,/APP_EXCLUDE_END/d" vt/www/index.html
# Phabricator.js
Phabricator.js is a node module used to call [Phabricator](http://phabricator.com) API.

# Update interfaces.json
If you have a new version of Phabricator, maybe some api in `interfaces.json` outdated. You can copy `tools/gen_api_interfaces.php` to `%PhabricatorPath%/scripts/util` and run it:
``
cp tools/gen_api_interfaces.php %PhabricatorPath%/scripts/util/
chmod +x %PhabricatorPath%/scripts/util/gen_api_interfaces.php
%PhabricatorPath%/scripts/util/gen_api_interfaces.php > interfaces.json
``
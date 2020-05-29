var path = require('path');

exports.REPO_URL = "ssh:git@gitlab.com:nextchain/www.git"; // "https://github.com/bitcoin-unlimited/BUwiki"
exports.PUSH_BRANCHES = ["refs/heads/master:refs/heads/master"];
exports.UPSTREAM_REPO_NAME = "origin";
exports.REPO_BRANCH_NAME = "master";

exports.SITE_NAME = "NextChain";

if (typeof process.env.CWIK_DEV !== "undefined") {
    exports.MY_URL = "http://192.168.1.100:8000";
    exports.STACKEDIT_URL = "http://192.168.1.100:8080/app";
    //exports.STACKEDIT_URL = "https://stackedit.io/app";
} else {
    exports.MY_URL = "http://www.nextchain.cash";
    // This is resolved client side so it must be a full domain
    exports.STACKEDIT_URL = "http://stackedit.nextchain.cash/app";
}

exports.COMMITTER_USERNAME = "buwiki";
exports.COMMITTER_EMAIL = "buwiki@protonmail.com";

exports.DEFAULT_COMMIT_MSG = "wiki commit";

exports.MAIN_REPO_DIR = path.resolve("./repo/mirror");
exports.USER_FORK_ROOT = path.resolve("./repo");

exports.MEDIA_EXT = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".ogg", ".wav" ]

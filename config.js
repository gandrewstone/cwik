var path = require('path');

exports.allowRegistration = "";

if (typeof process.env.XNEX !== "undefined") {
    exports.REPOS = [{
        URL: "git@gitlab.com:nextchain/www.git",
        PUSH_BRANCHES: ["refs/heads/master:refs/heads/master"],
        UPSTREAM_NAME: "origin",
        BRANCH_NAME: "master",
        DIR: "xnex",
        PREFIX: ""
    }];

    exports.SITE_NAME = "NextChain";
    exports.DEFAULT_PIC = "NextChainFlag.png";
    exports.MY_URL = "http://www.nextchain.cash";
    exports.MY_CVT_URL = exports.MY_URL + "/_cvt_";
    exports.STACKEDIT_URL = "http://stackedit.nextchain.cash/app";
    exports.allowRegistration = "bchidentity";
    exports.COMMITTER_USERNAME = "buwiki";
    exports.COMMITTER_EMAIL = "buwiki@protonmail.com";
} else if (typeof process.env.BUNET !== "undefined") {
    console.log("Running www.bitcoinunlimited.net configuration");
    exports.REPOS = [{
        URL: "git@github.com:bitcoin-unlimited/BUwiki.git",
        PUSH_BRANCHES: ["refs/heads/master:refs/heads/master"],
        UPSTREAM_NAME: "origin",
        BRANCH_NAME: "master",
        DIR: "buwiki",
        PREFIX: ""
    }, {
        URL: "git@github.com:BitcoinUnlimited/BitcoinCashSpecification.git",
        PUSH_BRANCHES: ["refs/heads/master:refs/heads/master"],
        UPSTREAM_NAME: "origin",
        BRANCH_NAME: "master",
        DIR: "bchspec",
        PREFIX: "ref"
    },{
        URL: "git@gitlab.com:bitcoinunlimited/BUIP.git",
        PUSH_BRANCHES: null, // no pushing allowed
        UPSTREAM_NAME: "origin",
        BRANCH_NAME: "master",
        DIR: "buipref",
        PREFIX: "buipref"
    },{
        URL: "git@gitlab.com:bitcoinunlimited/BCHUnlimited.git",
        PUSH_BRANCHES: null, // no pushing allowed
        UPSTREAM_NAME: "origin",
        BRANCH_NAME: "release",
        DIR: "bchunlimited",
        PREFIX: "bchunlimited"
    }
]

    exports.SITE_NAME = "BitcoinUnlimited";
    exports.DEFAULT_PIC = "bunet.png";
    exports.MY_URL = "http://www.bitcoinunlimited.net";
    exports.MY_CVT_URL = exports.MY_URL + "/_cvt_";
    exports.STACKEDIT_URL = "http://stackedit.bitcoinunlimited.net/app";
    exports.allowRegistration = "bchidentity";
    exports.COMMITTER_USERNAME = "buwiki";
    exports.COMMITTER_EMAIL = "buwiki@protonmail.com";
} else if (typeof process.env.BCHSPEC !== "undefined") {
    console.log("Running reference.cash configuration");
    exports.REPOS = [{
        URL: "git@github.com:BitcoinUnlimited/BitcoinCashSpecification.git",
        PUSH_BRANCHES: ["refs/heads/master:refs/heads/master"],
        UPSTREAM_NAME: "origin",
        BRANCH_NAME: "master",
        DIR: "bchspec",
        PREFIX: ""
    }]

    exports.SITE_NAME = "Bitcoin Cash Specification";
    exports.DEFAULT_PIC = "bunet.png";
    exports.MY_URL = "https://reference.cash";
    exports.MY_CVT_URL = "http://reference.cash/_cvt_";
    exports.STACKEDIT_URL = "https://stackedit.reference.cash/app";
    exports.allowRegistration = "bchidentity";
    exports.COMMITTER_USERNAME = "wiki";
    exports.COMMITTER_EMAIL = "wiki@reference.cash";
}


// Override for dev env
if (typeof process.env.CWIK_DEV !== "undefined") {
    exports.MY_URL = "http://192.168.1.100:8000";
    exports.MY_CVT_URL = exports.MY_URL + "/_cvt_";
    exports.STACKEDIT_URL = "http://192.168.1.100:8002/app";
    //exports.STACKEDIT_URL = "https://stackedit.io/app";
}

exports.DEFAULT_COMMIT_MSG = "wiki commit";
exports.ANON_REPO_SUBDIR = "mirror";
exports.MEDIA_EXT = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".ogg", ".wav", ".apk", ".zip", ".tgz", ".dmg"]

exports.USERS = {
    "bitcoincash:qpt0fvkshya5xxqec2njjx2wsr85ft7u0ces7vn6rf": {
        "hdl": "Andrew Stone",
        "email": "g.andrew.stone@gmail.com",
        "push": true,
        "merge": true,
        "propose": true,
        "comment": true
    }
}

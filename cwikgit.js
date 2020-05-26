var config = require("./config");
var git = require("nodegit");
var fs = require('fs');

var EP_SUBMISSIONS = "SUBMIT";


/* Provide git ssh credentials -- but only try 5 times then give up (otherwise nodeget goes into an infinite loop */
function ccred() {
    var nCalls = 0;

    function f(url, userName) {
        console.log("credentials requsted url: " + url + " username: " + userName + "Call Num: " + nCalls);
        if (nCalls > 5) throw "Credential failure";
        nCalls += 1;
        return git.Cred.sshKeyFromAgent(userName);
    }

    return f;
}


/**
 * Fetch from remote (credit https://stackoverflow.com/questions/20955393/nodegit-libgit2-for-node-js-how-to-push-and-pull/35656463)
 *
 * @param {string} repositoryPath - Path to local git repository
 * @param {string} remoteName - Remote name
 * @param {string} branch - Branch to fetch
 */
pull = function(repositoryPath, remoteName, branch, cb) {
    var repository;
    var remoteBranch = remoteName + '/' + branch;
    git.Repository.open(repositoryPath)
        .then(function(_repository) {
            console.log("gitPull.open ok");
            repository = _repository;
            var result = repository.fetch(remoteName, {
                callbacks: {
                    credentials: ccred()
                }
            }).then(function() {
                    console.log("fetch worked!");
                },
                function() {
                    console.log(" fetch failed!");
                });
            console.log("fetch started");
            return result;
        }, cb)
        .then(function() {
            console.log("gitPull.fetch ok");
            return repository.mergeBranches(branch, remoteBranch);
        }, cb)
        .then(function(oid) {
            console.log("gitPull.merge ok");
            cb(null, oid);
        }, cb);
};


pullRepo = function(repo, remoteName, branch, cb) {
    return new Promise(function(resolve, reject) {

        var remoteBranch = remoteName + '/' + branch;
        repo.fetch(remoteName, {
                callbacks: {
                    credentials: ccred()
                }
            }).then(function() {
            console.log("gitPull.fetch ok");
                repo.mergeBranches(branch, remoteBranch).then(resolve,reject);
            }, reject);
    });
}


push = function(repo, upstreamRepoName) {
    return new Promise(function(resolve, reject) {
        var p1 = git.Remote.lookup(repo, upstreamRepoName);
        var p2 = repo.getCurrentBranch();

        Promise.all([p1, p2]).then(results => {
                var remote = results[0];
                var branch = results[1];
                console.log("push");
                remote.push(branch + ":" + branch, {
                    callbacks: {
                        credentials: ccred()
                    }
                }).then(resolve, reject).catch(err => {
                    console.error("push catch error ", err);
                    reject(err);
                });
            },
            failure => {
                console.log("remote create failed" + failure);
                reject(failure);
            }
        );
    });
}

branch = function(repo, branchName, upstreamRepoName, create) {
    return new Promise(function(resolve, reject) {
        console.log(repo);
        pullRepo(repo, branchName, upstreamRepoName).then(oid => {
            console.log("pulled branch " + branchName + "to " + oid);
            repo.checkoutBranch(branchName).then(resolve, reject);
        }, err => {
            console.log("pull Repo error: " + JSON.stringify(err));
            console.log(typeof err);
            if (err.errno == git.Error.CODE.ENOTFOUND)  // its ok that the branch does not exist in the remote yet
            {
                repo.checkoutBranch(branchName).then(resolve, reject);
            }
            else if (create) {
                repo.getHeadCommit().then(commit => {
                    repo.createBranch(branchName, commit.id(), false).then(smth => {
                        pullRepo(repo, branchName, upstreamRepoName).then(oid => {
                            console.log("pulled branch " + branchName + "to " + oid);
                            repo.checkoutBranch(branchName).then(resolve, reject);
                        }, reject);
                    }
                        , reject);
                }, reject);
            }
            else {
                console.log("pullRepo error: " + err);
                reject(err);
            }
        });
    });
}


// All files that are modified are stored in a file so that we know what to commit.
// Perhaps this can be better accomplished with a git command
changedFiles = {}; // This is a dictionary of uid, Set() pairs

commitEdits = function(req, res, upstreamRepoName, comment) {
    var uid = req.session.uid;
    var user = uid.split(":")[1];
    var userSpace = config.USER_FORK_ROOT + "/" + user;
    if (comment == undefined) comment = config.DEFAULT_COMMIT_MSG;
    console.log("commit edits run: " + user + " repo " + userSpace);
    git.Repository.open(userSpace).then(function(repo) {
            var author = git.Signature.now(user, user + "@reference.cash");
            var committer = git.Signature.now(config.COMMITTER_USERNAME, config.COMMITTER_EMAIL);
            console.log("author " + user + "@reference.cash");
            console.log("committer " + "buwiki@protonmail.com");
            files = Array.from(changedFiles[uid].keys());
            console.log("files " + JSON.stringify(files));
            repo.createCommitOnHead(files, author, committer, comment).then(
                function(oid) {
                    console.log("commit worked " + oid);
                    changedFiles[uid].clear();
                    saveChangedFiles(uid, changedFiles[uid]);
                    push(repo, upstreamRepoName).then(function(number) {
                            console.log("push completed. returned " + number);
                            res.json({
                                notification: "commit and push completed"
                            });
                            refreshRepoEveryone();
                        },
                        function(failure) {
                            console.log("push failed " + failure.message);
                            res.json({
                                notification: "push failed " + failure.message
                            });
                        });
                },
                function(failure) {
                    console.log("remote create failed" + failure);
                }
            );
        },
        function(failure) {
            console.log("failed" + failure);
        });
}


const getDirectories = source =>
    fs.readdirSync(source, {
        withFileTypes: true
    })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

/** Pull from the origin in every user's repo */
refreshRepoEveryone = function() {
    repoDirs = getDirectories(config.USER_FORK_ROOT);
    console.log("repo dirs: " + repoDirs);
    for (i = 0; i < repoDirs.length; i++) {
        refreshRepoByDir(config.USER_FORK_ROOT + "/" + repoDirs[i], config.UPSTREAM_REPO_NAME);
    }
}

repoBranchNameByUid = function(uid) {
    return new Promise(function(resolve, reject) {
        repoBranchByUid(uid).then(branch => resolve(branch.shorthand()), reject);
    });
}

repoBranchNameByDir = function(dir) {
    return new Promise(function(resolve, reject) {
        repoBranchByDir(dir).then(branch => resolve(branch.shorthand()), reject);
    });
}

repoBranchByUid = function(uid) {
    var user = uid.split(":")[1];
    var userSpace = config.USER_FORK_ROOT + "/" + user;
    return repoBranchByDir(userSpace);
}

repoBranchByDir = function(userSpace) {
    return new Promise(function(resolve, reject) {
        git.Repository.open(userSpace).then(repo => {
            repo.getCurrentBranch().then(branch => {
                resolve(branch);
            }, reject);
        }, reject);

    });
}

repoByUid = function(uid) {
    let user = uid.split(":")[1];
    let userSpace = config.USER_FORK_ROOT + "/" + user;

    return new Promise(function(resolve, reject) {
        git.Repository.open(userSpace).then(resolve, reject);
        });
}



// do a git pull to sync the user's repo with the latest changes
refreshRepo = function(uid, upstreamRepoName) {
    var user = uid.split(":")[1];
    var userSpace = config.USER_FORK_ROOT + "/" + user;
    console.log("refresh repo: " + user + " dir: " + userSpace);

    repoBranchNameByUid(uid).then(result =>
        pull(userSpace, upstreamRepoName, result, function(err, oid) {
            if (err != null) console.log("pull error " + err);
        }));
}

// do a git pull to sync a repo with the latest changes
refreshRepoByDir = function(dir, upstreamRepoName) {
    console.log("refresh repo: " + dir);
    repoBranchNameByDir(dir).then(result => {
        console.log("rrbd result: " + result);
        pull(dir, upstreamRepoName, result, function(err, oid) {
            if (err != null) console.log("refreshRepoByDir: pull at " + dir + " from " + upstreamRepoName + " error: " + err);
        })
    });
}

// Load the list of changed files from disk.
loadChangedFiles = function(uid, sess) {
    let userSpace = config.USER_FORK_ROOT + "/" + uid.split(":")[1];
    let filepath = userSpace + "/.changedFiles.lst";
    console.log("load edited files from: " + filepath);
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) {
            console.log("file doesn't exist: " + err);
            changedFiles[uid] = new Set();
            console.log("assigned changedFiles ");
            return;
        }
        changedFiles[uid] = new Set(JSON.parse(data));
        console.log("edited file list: " + JSON.stringify(Array.from(changedFiles[uid].keys())));
    });
}

// Save the list of changed files to a file on disk.
saveChangedFiles = function(uid, changedFiles) {
    console.log("saveChangedFiles " + uid);
    let userSpace = config.USER_FORK_ROOT + "/" + uid.split(":")[1];
    console.log("userSpace " + userSpace);
    let filepath = userSpace + "/.changedFiles.lst";
    console.log("writing file change list: " + filepath);
    console.log(JSON.stringify(Array.from(changedFiles.keys())));
    fs.writeFile(userSpace + "/.changedFiles.lst", JSON.stringify(Array.from(changedFiles.keys())), (err) => {
        if (err)
            console.log("changed list write error: " + JSON.stringify(err));
        else
            console.log("changed list written");
    });
}

// Load the list of edit proposals from disk.
loadEditProposals = function(uid) {
    let userSpace = (uid == EP_SUBMISSIONS) ? config.MAIN_REPO_DIR : config.USER_FORK_ROOT + "/" + uid.split(":")[1];
    let filepath = userSpace + "/.editProposals.lst";
    console.log("load edited files from: " + filepath);
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) {
            console.log("file doesn't exist: " + err);
            editProposals[uid] = new Set();
            return;
        }
        editProposals[uid] = new Set(JSON.parse(data));
        console.log("edit proposals: " + JSON.stringify(Array.from(editProposals[uid].keys())));
    });
}

// Save the list of changed files to a file on disk.
saveEditProposals = function(uid, editProposals) {
    console.log("saveEditProposals " + uid);
    let userSpace = (uid == EP_SUBMISSIONS) ? config.MAIN_REPO_DIR : config.USER_FORK_ROOT + "/" + uid.split(":")[1];
    console.log("userSpace " + userSpace);
    let filepath = userSpace + "/.editProposals.lst";
    console.log("writing file change list: " + filepath);
    console.log(JSON.stringify(Array.from(changedFiles.keys())));
    fs.writeFile(userSpace + "/.editProposals.lst", JSON.stringify(Array.from(changedFiles.keys())), (err) => {
        if (err)
            console.log("edit proposal write error: " + JSON.stringify(err));
        else
            console.log("edit proposals written");
    });
}

var diffBranch = function(repo, branchName) {
    console.log("diffBranch");
    return new Promise(function(resolve, reject) {
        console.log("diffBranch promise" + branchName);
        repo.getBranchCommit(branchName).then(commit => {
            console.log("gbc ok");
            console.log("head of " + branchName);
            console.log(" is " + commit.id().tostrS());
            console.log(" msg: " + commit.message());
            diffCommit(repo, commit).then(resolve,reject);
        }, reject);
    });
};

var diffCommit = function(repo, commit) {
    return new Promise(function(resolve, reject) {
        commit.getTree().then(tree => {
            git.Diff.treeToWorkdir(repo, tree).then(diff => {
                return resolve(diff);
            }, reject);
        }, reject);
    })
};

exports.pull = pull;
exports.commitEdits = commitEdits;
exports.refreshRepoEveryone = refreshRepoEveryone;
exports.refreshRepo = refreshRepo;
exports.refreshRepoByDir = refreshRepoByDir;

exports.changedFiles = changedFiles;
exports.loadChangedFiles = loadChangedFiles;
exports.saveChangedFiles = saveChangedFiles;
exports.repoBranchNameByUid = repoBranchNameByUid;
exports.repoBranchByUid = repoBranchByUid;
exports.repoBranchByDir = repoBranchByDir;
exports.repoByUid = repoByUid;
exports.branch = branch;
exports.EP_SUBMISSIONS = EP_SUBMISSIONS;
exports.diffBranch = diffBranch;
exports.diffCommit = diffCommit;

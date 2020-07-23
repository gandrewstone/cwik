var config = require("./config");
var git = require("nodegit");
var fs = require('fs');
var ncp = require('ncp').ncp;
ncp.limit = 16; // number of simultaneous copy operations allowed

var EP_SUBMISSIONS = "SUBMIT";

function repoUserDir(repoCfg, uid) {
    return repoCfg.DIR + "/" + uid.split(":")[1];
}

/* Provide git ssh credentials -- but only try 5 times then give up (otherwise nodeget goes into an infinite loop */
function ccred() {
    var nCalls = 0;

    function f(url, userName) {
        console.log("credentials requsted url: " + url + " username: " + userName + " call count: " + nCalls);
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
        console.log("pullRepo " + remoteName + " " + branch);
        var remoteBranch = remoteName + '/' + branch;
        repo.fetch(remoteName, {
            callbacks: {
                credentials: ccred()
            }
        }).then(function() {
            console.log("gitPull.fetch ok");
            repo.mergeBranches(branch, remoteBranch).then(
		resolve,
		err => {
		    console.log("No local branch");
		    resolve();
		});
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
                console.log("remote create failed: " + failure);
                reject(failure);
            }
        );
    });
}

checkoutRemoteBranch = function(repo, upstreamRepoName, branchName) {
    return new Promise(function(resolve, reject) {
        console.log("checkoutRemoteBranch " + branchName + " from " + upstreamRepoName)
	repo.getBranchCommit("refs/remotes/" + upstreamRepoName + "/" + branchName)
	    .then(function(commit) {
		console.log("found remote branch: " + commit);
		repo.createBranch(branchName, commit.id(), false).then(
		    smth => {
                            console.log("created branch off remote");
                            repo.checkoutBranch(branchName).then(resolve, reject);
                    },
		    err => {
			console.log("create branch error: " + err);
			reject(err);
		    });
		// repo.checkoutRef(reference)
	    },
                  err => {
                      console.log("no remote branch: " + err + ". Creating local branch");
                      repo.getHeadCommit().then(commit => {
                          repo.createBranch(branchName, commit.id(), false).then(
                              smth => {
                                  console.log("created branch");
                                  repo.checkoutBranch(branchName).then(resolve, reject);
                              })
                      })
                  }
                 );
    });
}
		      

branch = function(repo, branchName, upstreamRepoName, create) {
    return new Promise(function(resolve, reject) {
        pullRepo(repo, upstreamRepoName, branchName).then(oid => {
            console.log("pulled branch " + branchName + " to " + oid);
            repo.checkoutBranch(branchName).then(resolve,
						 err => {
						     console.log("local checkout errored with: " + err + ". Trying remote");
						     checkoutRemoteBranch(repo, upstreamRepoName, branchName).then(resolve, reject);
						 });
        }, err => {  // This is expected if the branch hasn't been created yet
            console.log("pull Repo error: " + err + " " + JSON.stringify(err));
	    if (err.errno == git.Error.CODE.ERROR)  // probably an auth problem
	    {
		reject(err);
		return;
	    }
            if (err.errno != git.Error.CODE.ENOTFOUND) // its ok that the branch does not exist in the remote yet
            {
                repo.checkoutBranch(branchName).then(resolve, reject);
            } else if (create) {
                console.log("creating branch");
                repo.getHeadCommit().then(commit => {
                    console.log("got head commit");
                    repo.createBranch(branchName, commit.id(), false).then(
                        smth => {
                            console.log("created branch");
                            repo.checkoutBranch(branchName).then(resolve, reject);
                        },            
                        err => { // Not a problem the branch already exists
                            if (err.errno == git.Error.CODE.EEXISTS) {
                                // pull it from the remote
                                pullRepo(repo, upstreamRepoName, branchName).then(
                                    oid => {
                                        console.log("pulled branch " + branchName + "to " + oid);
                                        repo.checkoutBranch(branchName).then(resolve, reject);
                                    },
                                    err => {
                                        // OK doesn't exist in the remote so open locally only
                                        repo.checkoutBranch(branchName).then(resolve, reject);
                                    });
                            } else reject(err);
                        }
                    );
                }, reject);
            } else {
                console.log("pullRepo error: " + err);
                reject(err);
            }
        });
    });
}


// All files that are modified are stored in a file so that we know what to commit.
// Perhaps this can be better accomplished with a git command
changedFiles = {}; // This is a dictionary of uid, Set() pairs

commitEdits = function(req, res, repoCfg, comment, userInfo) {
    var uid = req.session.uid;
    let userName = uid.split(":")[1];
    if (typeof userInfo.hdl !== "undefined")
        userName = userInfo.hdl;
    let userEmail = uid + "@" + config.MY_URL.split("//")[1];
    if (typeof userInfo.email !== "undefined")
        userEmail = userInfo.email;
    var userSpace = repoUserDir(repoCfg, uid);
    console.log("commit")
    if (comment == null) comment = config.DEFAULT_COMMIT_MSG;
    console.log("commit edits run: " + userName + " repo " + userSpace);
    git.Repository.open(userSpace).then(function(repo) {
            var author = git.Signature.now(userName, userEmail);
            var committer = git.Signature.now(config.COMMITTER_USERNAME, config.COMMITTER_EMAIL);
            console.log("author " + userName + " " + userEmail);
            console.log("committer " + "buwiki@protonmail.com");
            files = Array.from(changedFiles[uid].keys());
            console.log("files " + JSON.stringify(files));
            repo.createCommitOnHead(files, author, committer, comment).then(
                function(oid) {
                    console.log("commit worked " + oid);
                    changedFiles[uid].clear();
                    saveChangedFiles(repoCfg, uid, changedFiles[uid]);
                    push(repo, repoCfg.UPSTREAM_NAME).then(function(number) {
                            console.log("push completed. returned " + number);
                            res.json({
                                notification: "commit and push completed"
                            });
                            refreshRepoEveryone();
                        },
                        function(failure) {
                            console.log("push failed: " + failure.message);
                            res.json({
                                notification: "push failed: " + failure.message
                            });
                        });
                },
                function(failure) {
                    console.log("remote create failed: " + failure);
                }
            );
        },
        function(failure) {
            console.log("failed: " + failure);
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
    config.REPOS.forEach(repo => {
        repoDirs = getDirectories(repo.DIR);
        console.log("repo dirs: " + repoDirs);
        for (i = 0; i < repoDirs.length; i++) {
            refreshRepoByDir(repo.DIR + "/" + repoDirs[i], repo.UPSTREAM_NAME);
        }
    });
}

repoBranchNameByUid = function(repoCfg, uid) {
    console.log("repoBranchNameByUid");
    return new Promise(function(resolve, reject) {
        repoBranchByUid(repoCfg, uid).then(branch => {
            console.log("branch shorthand: " + branch.shorthand());
            resolve(branch.shorthand())
        }, reject);
    });
}

repoBranchNameByDir = function(dir) {
    return new Promise(function(resolve, reject) {
        repoBranchByDir(dir).then(branch => resolve(branch.shorthand()), reject);
    });
}

repoBranchByUid = function(repoCfg, uid) {
    let userSpace = repoUserDir(repoCfg, uid);
    return repoBranchByDir(userSpace);
};

/*
repoBranchByUid = function(uid) {
    let user = uid.split(":")[1];
    return Promise.all(config.REPOS.map(repo => {
        let userSpace = config.USER_FORK_ROOT + "/" + user;
        return repoBranchByDir(userSpace);
    }));
}
*/

repoBranchByDir = function(userSpace) {
    console.log("repoBranchByDir");
    return new Promise(function(resolve, reject) {
        console.log("repoBranchByDir promise " + userSpace);
        git.Repository.open(userSpace).then(repo => {
            console.log("Opened repo");
            repo.getCurrentBranch().then(branch => {
                console.log("got branch");
                resolve(branch);
            }, reject);
        }, reject);
    });
}

repoByUid = function(repoCfg, uid) {
    console.log("repoCfg is " + JSON.stringify(repoCfg));
    let userSpace = repoUserDir(repoCfg, uid);
    console.log("userspace: " + userSpace + " " + repoCfg.DIR + " " + uid);

    return new Promise(function(resolve, reject) {
        git.Repository.open(userSpace).then(resolve, reject);
    });
}



// do a git pull to sync the user's repo with the latest changes
refreshRepo = function(repoCfg, uid) {
    let userSpace = repoUserDir(repoCfg, uid);
    console.log("refresh repo: " + userSpace);

    return repoBranchNameByDir(userSpace).then(result =>
        pull(userSpace, repoCfg.UPSTREAM_NAME, result, function(err, oid) {
            if (err != null) console.log("pull error " + err);
        }));
}

// do a git pull to sync the user's repo with the latest changes
refreshRepoUser = function(uid) {
    return Promise.all(config.REPOS.map(repoCfg => refreshRepo(repoCfg, uid)));
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
loadChangedFiles = function(repoCfg, uid, sess) {
    let userSpace = repoUserDir(repoCfg, uid);
    let filepath = userSpace + "/.changedFiles.lst";
    console.log("load edited files from: " + filepath);
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) {
            console.log("file doesn't exist: " + err);
            changedFiles[uid] = new Set();
            // console.log("assigned changedFiles ");
            return;
        }
        changedFiles[uid] = new Set(JSON.parse(data));
        console.log("edited file list: " + JSON.stringify(Array.from(changedFiles[uid].keys())));
    });
}

// Save the list of changed files to a file on disk.
saveChangedFiles = function(repoCfg, uid, changedFiles) {
    console.log("saveChangedFiles " + uid);
    let userSpace = repoUserDir(repoCfg, uid);
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
loadEditProposals = function(repoCfg, uid) {
    let userSpace = (uid == EP_SUBMISSIONS) ? config.MAIN_REPO_DIR : repoUserDir(repoCfg, uid);
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
    let userSpace = (uid == EP_SUBMISSIONS) ? config.MAIN_REPO_DIR : repoUserDir(repoCfg, uid);
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
            diffCommit(repo, commit).then(resolve, reject);
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

function ensureUserRepoCreated(repoCfg, userSpace, contentHome) {
    // Make a working space for this user if one does not yet exist
    if (!fs.existsSync(userSpace)) {
        // Refresh my local copy
        git.pull(contentHome, repoCfg.UPSTREAM_NAME, repoCfg.BRANCH_NAME,
            function(err, oid) {
                if (err != null) console.log("pull " + contentHome + " error " + err);

                // then copy it to the user's space
                ncp(contentHome, userSpace, function(err) {
                    if (err) {
                        console.error("ncp copy error: " + err);
                        return contentHome;
                    }
                    console.log("user scratch space created!");
                });
            });
        return contentHome; // While I'm waiting for the copy, allow the user to read
    }
    return userSpace;
}

function ensureUserRepoCreated2(repoCfg, uid) {
    let userSpace = repoUserDir(repoCfg, uid);
    let anonSpace = repoCfg.DIR + "/" + config.ANON_REPO_SUBDIR;

    // Make a working space for this user if one does not yet exist
    if (!fs.existsSync(userSpace)) {
        // Refresh my local copy
        pull(anonSpace, repoCfg.UPSTREAM_NAME, repoCfg.BRANCH_NAME,
            function(err, oid) {
                if (err != null) console.log("pull " + contentHome + " error " + err);

                // then copy it to the user's space
                ncp(anonSpace, userSpace, function(err) {
                    if (err) {
                        console.error("ncp copy error: " + err);
                        return contentHome;
                    }
                    console.log("user scratch space created!");
                });
            });
        return anonSpace; // While I'm waiting for the copy, allow the user to read
    }
    return userSpace;
}



function ensureUserReposCreated(uid) {
    return Promise.all(config.REPOS.map(repoCfg => ensureUserRepoCreated2(repoCfg, uid)));
}


exports.pull = pull;
exports.push = push;
exports.commitEdits = commitEdits;
exports.refreshRepoEveryone = refreshRepoEveryone;
exports.refreshRepoUser = refreshRepoUser;
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

exports.ccred = ccred;

exports.ensureUserReposCreated = ensureUserReposCreated;

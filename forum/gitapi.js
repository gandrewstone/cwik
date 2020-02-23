var forum_repo = require("./git_config.json");
var fs = require('fs');
var git = require("nodegit");
var pagedown = require("pagedown");

var PUSH_BRANCHES = ["refs/heads/master:refs/heads/master"];
var UPSTREAM_REPO_NAME = forum_repo.repo_upstream_name; // "origin";
var REPO_BRANCH_NAME = forum_repo.repo_branch; // "master";

var work_dir = "";
GetWorkDir = function()
{
    if (work_dir === "")
    {
        git.Repository.open(userForumRoot)
            .then(function(repo)
            {
                work_dir = repo.workdir();
                return work_dir;
            })
    }
    else
    {
        return work_dir;
    }
}

CommitToRepo = function(changedFiles, user)
{
    git.Repository.open(userForumRoot)
        .then(function(repo)
        {
            var author = git.Signature.now(user, user + "@reference.cash");
            var commiter = git.Signature.now(forum_repo.commiter_name, forum_repo.commiter_email);
            console.log("author " + user + "@reference.cash");
            console.log("commiter " + forum_repo.commiter_email);
            var commitMessage = "new post created by " + user + "@reference.cash";
            repo.createCommitOnHead(changedFiles, author, commiter, commitMessage)
                .then(function (oid)
                {
                    console.log("worked " + oid);
                    git.Remote.lookup(repo, forum_repo.repo_upstream_name)
                        .then(function(remote)
                        {
                            console.log("push");
                            remote.push(forum_repo.push_branches,
                            {
                                callbacks:
                                {
                                    credentials: function(url, userName)
                                    {
                                        console.log("credentials requsted url: " + url + " username: " + userName);
                                        return git.Cred.sshKeyFromAgent(userName);
                                    }
                                }
                            })
                            .then(function(number)
                            {
                                console.log("push completed. returned " + number);
                                // refreshRepoEveryone();
                            },
                            function(failure)
                            {
                                console.log("push failed " + failure);
                            }).catch(err => { console.error("push catch error ", err) });
                        },
                        function(failure)
                        {
                            console.log("remote create failed" + failure);
                        }
                    );
                },
                function (failure)
                {
                    console.log("failed" + failure);
                });
        },
        function(failure)
        {
            console.log("fail");
            console.log("failed! " + JSON.stringify(failure));
        });
}

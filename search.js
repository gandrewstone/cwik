var lunr = require("lunr")
var fs = require('fs').promises;
var path = require('path');
var config = require('./config');
var misc = require('./misc');
var mdToHtml = require('./mdtohtml');


var searchIndex = null;


/* This class works by executing the finishing step when qty == done.  qty should be set up to be incremented mostly synchronously during execution,
and async calls to "finish" done.  Since "qty" gets way ahead of "done", the finishing logic is run once when done catches up.  If done does catch up multiple times during execution,
the finishing logic will be executed multiple times.  If you are worried about that, set up your finishing logic to be benign (but likely inefficient) if it is repeatedly executed. */
function SearchFinisher() {
    this.done = 0;
    this.qty = 0;
    this.results = [];
    let res = this.results;

    this.finish = (result) => {
        res.push(result);
        this.done += 1;
        // console.log("d: " + this.done + "  q: " + this.qty);
        if ((this.qty == 0) || (this.qty > this.done)) return;

        // Final finishing logic
        searchIndex = lunr(function() {
            this.field('title', {
                boost: 10
            });
            this.field('page', {
                boost: 5
            });
            this.field('summary', {
                boost: 5
            });
            this.field('body');
            this.ref('href');
            this.metadataWhitelist = ['position'];
            console.log("generating lunr index");
            res.forEach(r => this.add(r));
        });
    }
}


async function reindex() {
    config.REPOS.forEach(async (repoCfg) => {
        dirPrefix = path.resolve(repoCfg.DIR + "/" + config.ANON_REPO_SUBDIR);
        let results = [];

        let sf = new SearchFinisher();

        for await (const f of misc.getFiles(dirPrefix)) {
            if (f.endsWith(".md")) {
                sf.qty += 1;
                metaf = f.slice(0, f.length - 2) + "meta";
                misc.allSettled(fs.open(f, 'r'), fs.open(metaf, 'r')).
                then(hdls => {
                    let reads = [hdls[0].readFile({
                        encoding: "utf-8"
                    })];
                    if (hdls[1].errno == undefined) {
                        reads.push(hdls[1].readFile({
                            encoding: "utf-8"
                        }));
                    }

                    misc.allSettled(reads).
                    then(contentsLst => {
                        hdls.forEach(hdl => {
                            hdl.close ? hdl.close() : null;
                        });
                        let contents = contentsLst[0];
                        let title = undefined;
                        let summary = undefined;
                        if ((contentsLst.length > 1) && (contentsLst[1].errno == undefined)) // we have a good metadata read
                        {
                            let metadata = JSON.parse(contentsLst[1]);
                            title = metadata['title'];
                            summary = metadata['summary'];
                        }
                        console.log("search processed: " + f);
                        // console.log("contains: " + contents);
                        let repoFname = f.slice(dirPrefix.length, f.length);
                        //results.push({title:repoFname, body:"this\nis\na test", href: repoFname});
                        sf.finish({
                            title: title,
                            summary: summary,
                            body: contents,
                            page: repoFname,
                            href: repoFname
                        });
                    });
                }).
                catch(e => {
                    console.log("Error in " + f + ": " + e);
                });
            }
        }
    });
}


function search(query) {
    let result = searchIndex.search(query);
    // console.log(JSON.stringify(result));
    return result;
}

exports.search = search;
exports.reindex = reindex;
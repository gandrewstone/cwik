var puppeteer = require('puppeteer');
var sanitizer = require("sanitize-html");
var config = require("./config");
var misc = require("./misc");
var fssync = require('fs');
var fs = fssync.promises;

var path = require('path');

const PuppeteerDebug = false;  // true;  // remember printToPdf won't work when debug is true

let titles = ["h1", "h2", "h3", "h4", "h5", "h6"];

let acceptableTags = ['text', 'line', 'tspan', 'br', 'em', 'mi', 'mo', 'mn', 'msup', 'mrow', 'mspace', 'span', 'annotation', 'semantics', 'math', 'span', 'circle', 'g', 'path', 'rect', 'polygon', 'marker', 'defs', 'foreignobject', 'style', 'svg', 'div',
    'iframe', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'sup', 'sub', 'video', 'source', 'audio'
];

let mathMLTags = ['abs', 'and', 'annotation', 'annotation-xml', 'apply', 'approx', 'arccos', 'arccosh', 'arccot', 'arccoth', 'arccsc', 'arccsch', 'arcsec', 'arcsech', 'arcsin', 'arcsinh', 'arctan', 'arctanh', 'arg', 'bvar', 'card', 'cartesianproduct',
    'ceiling', 'ci', 'cn', 'codomain', 'complexes', 'compose', 'condition', 'conjugate', 'cos', 'cosh', 'cot', 'coth', 'csc', 'csch', 'csymbol', 'curl', 'declare', 'degree', 'determinant', 'diff', 'divergence', 'divide', 'domain', 'domainofapplication',
    'emptyset', 'encoding', 'eq', 'equivalent', 'eulergamma', 'exists', 'exp', 'exponentiale', 'factorial', 'factorof', 'false', 'floor', 'fn', 'forall', 'function', 'gcd', 'geq', 'grad', 'gt', 'ident', 'image', 'imaginary', 'imaginaryi', 'implies', 'in',
    'infinity', 'int', 'integers', 'intersect', 'interval', 'inverse', 'lambda', 'laplacian', 'lcm', 'leq', 'limit', 'list', 'ln', 'log', 'logbase', 'lowlimit', 'lt', 'm:apply', 'm:mrow', 'maction', 'malign', 'maligngroup', 'malignmark', 'malignscope',
    'math', 'matrix', 'matrixrow', 'max', 'mean', 'median', 'menclose', 'merror', 'mfenced', 'mfrac', 'mfraction', 'mglyph', 'mi', 'min', 'minus', 'mlabeledtr', 'mmultiscripts', 'mn', 'mo', 'mode', 'moment', 'momentabout', 'mover', 'mpadded', 'mphantom',
    'mprescripts', 'mroot', 'mrow', 'ms', 'mspace', 'msqrt', 'mstyle', 'msub', 'msubsup', 'msup', 'mtable', 'mtd', 'mtext', 'mtr', 'munder', 'munderover', 'naturalnumbers', 'neq', 'none', 'not', 'notanumber', 'notin', 'notprsubset', 'notsubset', 'or',
    'otherwise', 'outerproduct', 'partialdiff', 'pi', 'piece', 'piecewice', 'piecewise', 'plus', 'power', 'primes', 'product', 'prsubset', 'quotient', 'rationals', 'real', 'reals', 'reln', 'rem', 'root', 'scalarproduct', 'sdev', 'sec', 'sech', 'selector',
    'semantics', 'sep', 'set', 'setdiff', 'sin', 'sinh', 'subset', 'sum', 'tan', 'tanh', 'tendsto', 'times', 'transpose', 'true', 'union', 'uplimit', 'variance', 'vector', 'vectorproduct', 'xor'
]

let svgTags = ['a',
    'animate',
    'animateMotion',
    'animateTransform',
    'circle',
    'clipPath',
    'color-profile',
    'defs',
    'desc',
    'discard',
    'ellipse',
    'feBlend',
    'feColorMatrix',
    'feComponentTransfer',
    'feComposite',
    'feConvolveMatrix',
    'feDiffuseLighting',
    'feDisplacementMap',
    'feDistantLight',
    'feDropShadow',
    'feFlood',
    'feFuncA',
    'feFuncB',
    'feFuncG',
    'feFuncR',
    'feGaussianBlur',
    'feImage',
    'feMerge',
    'feMergeNode',
    'feMorphology',
    'feOffset',
    'fePointLight',
    'feSpecularLighting',
    'feSpotLight',
    'feTile',
    'feTurbulence',
    'filter',
    'foreignObject',
    'g',
    'hatch',
    'hatchpath',
    'image',
    'line',
    'linearGradient',
    'marker',
    'mask',
    'mesh',
    'meshgradient',
    'meshpatch',
    'meshrow',
    'metadata',
    'mpath',
    'path',
    'pattern',
    'polygon',
    'polyline',
    'radialGradient',
    'rect',
    'script',
    'set',
    'solidcolor',
    'stop',
    'style',
    'svg',
    'switch',
    'symbol',
    'text',
    'textPath',
    'title',
    'tspan',
    'unknown',
    'use',
    'view'
]


// Perfect conversion of md to html is a client-side process because some libraries are not available on the server side.
// For this reason we must create a client on the server side, and drive it to execute the conversion.
var browser = undefined;

async function init() {
    browser = await puppeteer.launch({
        headless: !PuppeteerDebug,
        defaultViewport: {
            width: 900,
            height: 1024
        }
    });
}

async function staticHtmlToPdf(html, destinationFile) {
    const page = await browser.newPage();
    await page.setContent(html);
    //await page.goto(`data:text/html,${html}`, { waitUntil: 'networkidle0' });
    await page.pdf({ path: destinationFile, format: 'A4' })
    if (!PuppeteerDebug) page.close();
}

async function pageToPdf(link, destinationFile) {
    const page = await browser.newPage();
    await page.goto(config.MY_URL + link + "?contentonly=1", { waitUntil: 'networkidle0' });
    await page.pdf({ path: destinationFile, format: 'A4' })
    if (!PuppeteerDebug) page.close();
}

async function mdToHtml(md) {
    let headings = ""
    let titleFromDoc = null
    let summaryFromDoc = null
    let picFromDoc = null
    appendHeading = function(tagName, text, attribs) {
        // console.log("TAG: " + tagName + " " + text)
        linktext = text.replace("/", ""); // drop any /s
        linktext = linktext.replace("?", "");
        linktext = linktext.replace(":", "");
        linktext = linktext.replace("!", "");
        linktext = linktext.replace("(", "");
        linktext = linktext.replace(")", "");
        headings += '<a class="ltoc_' + tagName + '"' + ' onclick="jumpTo(\'' + linktext + '\'); return false;"' + ' href="#' + linktext + '"' + '><span class="itoc_' + tagName + '">' + text + "</span></a>\n"
    };

    const page = await browser.newPage();
    await page.goto(config.MY_CVT_URL);

    await page.evaluate(function(md) {
        contentRenderCallback = function() {
            console.log("content rendered")
        };
        return processFetchedMd(md);
    }, md);
    //await page.waitFor(250);  // Do I need to wait for the katex, mermaid, etc to render or is that done synchronously?  If so, can wait for custom event: https://github.com/puppeteer/puppeteer/blob/master/examples/custom-event.js
    const contentHtml = await page.evaluate("document.querySelector('.wikicontent').innerHTML");
    if (!PuppeteerDebug) page.close();

    // If you need to see the raw content to figure out what the sanitizer is doing wrong:
    // fs.writeFile("content.htm", contentHtml, (err) => {});

    let okTags = sanitizer.defaults.allowedTags;
    okTags = okTags.concat(mathMLTags);
    okTags = okTags.concat(svgTags);
    okTags = okTags.concat(acceptableTags);

    let meta = {};
    xformedhtml = sanitizer(contentHtml, {
        allowedTags: okTags,
        allowedAttributes: false,
        allowedClasses: false,
        transformTags: {
            "h1": (tagName, attribs) => {
                return {
                    tagName: tagName,
                    attribs: attribs,
                }
            },
        },
        exclusiveFilter: function(frame) {
            // console.log(JSON.stringify(frame));
            if (titles.includes(frame.tag)) appendHeading(frame.tag, frame.text, frame.attribs);
            if (frame.tag == "h1") { // Use the first h1 as the title
                if (titleFromDoc == null) titleFromDoc = frame.text;
            }
            if (frame.tag == "em") { // Use the first italics (em) as the summary
                if (summaryFromDoc == null) summaryFromDoc = frame.text;
            }
            if (frame.tag == "img") { // Use the first image as the advertisement pic
                if (picFromDoc == null) picFromDoc = frame.attribs.src;
            }

            if (frame.tag == "div" && frame.attribs["class"] == "cwikmeta") {
                try {
                    // console.log("parsing: " + frame.text);
                    meta = JSON.parse(frame.text);
                } catch (err) {
                    console.log(err);
                    console.log(err.stack);
                    // error += err.message;
                }
                return false;
            }
            return false; // Don't remove anything based on this filter -- I am just trying to extract headings
        },
        // This filter wraps an anchor around every heading to support section links
        textFilter: function(text, tagName) {
            if (tagName == "h1") {
                return '<a href="' + misc.HeadingToAnchor(text) + '">' + text + '</a>';
            }
            return text
        }
    });

    ret = {
        html: xformedhtml,
        structure: headings
    }

    if (typeof meta.title !== "undefined") ret["title"] = meta.title;
    else if (titleFromDoc) ret["title"] = titleFromDoc;

    if (typeof meta.related !== "undefined") ret["related"] = meta.related;

    if (typeof meta.summary !== "undefined") ret["summary"] = meta.summary;
    else if (summaryFromDoc) ret["summary"] = summaryFromDoc;

    if (typeof meta.pic !== "undefined") ret["pic"] = meta.pic;
    else if (picFromDoc) ret["pic"] = picFromDoc;

    return ret;
}


/* This class works by executing the finishing step when qty == done.  qty should be set up to be incremented mostly synchronously during execution,
and async calls to "finish" done.  Since "qty" gets way ahead of "done", the finishing logic is run once when done catches up.  If done does catch up multiple times during execution,
the finishing logic will be executed multiple times.  If you are worried about that, set up your finishing logic to be benign (but likely inefficient) if it is repeatedly executed. */
function Finisher(cb) {
    this.done = 0;
    this.qty = 0;
    this.results = [];
    let res = this.results;

    this.finish = (result) => {
        res.push(result);
        this.done += 1;
        // console.log("d: " + this.done + "  q: " + this.qty);
        if ((this.qty == 0) || (this.qty > this.done)) return;
        cb(this.results);

    }
}


async function generate() {

    for await (const repoCfg of config.REPOS) {
        dirPrefix = path.resolve(repoCfg.DIR + "/" + config.ANON_REPO_SUBDIR);
        let results = [];


        for await (const f of misc.getFiles(dirPrefix)) {
            if (f.endsWith(".md")) {
                console.log("converting " + f);
                let htmlFile = f.slice(0, f.length - 2) + "htm";
                let metaFile = f.slice(0, f.length - 2) + "meta";

                let regenerate = false;
                try {
                    let htmlFileStats = fssync.statSync(htmlFile);
                    let mdFileStats = fssync.statSync(f);
                    if (htmlFileStats.mtime <= mdFileStats.mtime) regenerate = true;
                } catch (err) { // file doesn't exist
                    // console.log(err);
                    regenerate = true;
                }


                if (regenerate) try {
                    console.log("regeneration of " + f + " required.");
                    let hdl = await fs.open(f, 'r');
                    let data = await hdl.readFile({
                        encoding: "utf-8"
                    });
                    await hdl.close();
                    console.log("file loaded");
                    let result = await mdToHtml(data);
                    console.log("file converted");
                    let html = result.html;
                    delete result.html;

                    await fs.writeFile(htmlFile, html, function(err) {
                        if (err != null) console.log("write error for: " + htmlFile + ": " + err);
                    })
                    await fs.writeFile(metaFile, JSON.stringify(result), function(err) {
                        if (err != null) console.log("write error for: " + metaFile + ": " + err);
                    })
                } catch (err) {
                    console.log("Error transforming: " + f + ": " + err);
                    console.log(err.stack);
                }
            }
        }
    }


}


exports.init = init;
exports.generate = generate;


exports.mdToHtml = mdToHtml;
exports.staticHtmlToPdf = staticHtmlToPdf;
exports.pageToPdf = pageToPdf;

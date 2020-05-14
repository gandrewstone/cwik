var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var memoryStore = require('memorystore')(session);

var config = require("./config");
var pageaccess = require("./pageaccess");
var index = require('./routes/index');
var users = require('./routes/users');

gitrepo = null;
contentHome = path.resolve("./repo/mirror");
userForkRoot = path.resolve("./repo");
var git = require("nodegit");

var app = express();

console.log("repo clone: " + config.REPO_URL);
git.Clone(config.REPO_URL,contentHome).then(function(repo) {
    gitrepo = repo;
    console.log("repo cloned");
}, function(error) {
    console.log("repo clone error" + error);
})

refreshRepoByDir(contentHome)

sessionStore = new memoryStore({
      checkPeriod: 86400000 // prune expired entries every 24hrs
});
// set up session
sessions = session({
    secret: 'cwik secret',
    saveUninitialized: true,
    resave: true,
    // You can stay logged in for a month.  This should be reduced for other apps but for this wiki you will silently lose your page edit if
    // your session expires while editing a page.
    cookie: { maxAge: 86400000*31 },
    store: sessionStore
});
app.use(sessions);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text({type: 'text/plain'}));

app.use(cookieParser());
app.use("/_static_", express.static(path.join(__dirname, 'public'),{extensions:['js','css','json','html']}));
//app.use("/_static_", express.static(path.join(__dirname, 'node_modules'),{extensions:['js','css','json','html']}));
//app.use("/_static_/js", express.static(path.join(__dirname, 'node_modules'),{extensions:['js','css','json','html']}));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

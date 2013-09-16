/*
*   nc-subdomainer
*   Namecheap subdomain manager
*/

/**  Depends  **/
var express = require('express'),
    swig = require('swig'),
    Namecheap = require('namecheap'),
    redis = require("redis"), client,
    async = require("async"),
    settings = require("./settings").settings,
    passport = require("passport"), domain,
    GitHubStrategy = require("passport-github").Strategy,
    site = module.exports = express();
var redisStore = require("connect-redis")(express);

if (!settings.NCSUBDOMAIN){
    process.exit("Missing nc-subdomainer access domain name!");
}
if (!settings.GITHUB_CLIENT_ID || !settings.GITHUB_CLIENT_ID){
    process.exit("Missing Github creds!");
}

var GITHUB_CLIENT_ID = settings.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET = settings.GITHUB_CLIENT_SECRET;

var namecheap = new Namecheap(settings.NC_USER, settings.NC_APIKEY, settings.NC_ALLOWEDIP);

//Dev mode
site.configure('dev', function(){
    //Set your domain name for your development environment
    domain = settings.NCSUBDOMAIN || "localhost";
    site.set('domain', domain);
    client = redis.createClient();
    site.use(express.logger('dev'));
    console.log("Running in dev mode");
});
//Live deployed mode
site.configure('live', function(){
    domain = settings.NCSUBDOMAIN || "localhost";
    //Set your live domain name here
    site.set('domain', 'viafoundry.com');
    client = redis.createClient();
});

// Passport
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// GITHUB
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://" + domain + ":8888/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    client.get();
    /*User.findOrCreate({ githubId: profile.id }, function (err, user) {
      return done(err, user);
    });*/
  }
));

/**  Configuration  **/
site.configure(function(){
    //Setup views and swig templates
    site.engine('html', swig.renderFile);
    swig.setDefaults({ cache: false, layout: false }); //For extends and block tags in swig templates
    //Configure Express to use swig
    site.set('views', __dirname + '/views');
    site.set('view engine', 'html');
    //The rest of our static-served files
    site.use(express.static(__dirname + '/public'));

    /** Middleware **/
    site.use(express.cookieParser());
    site.use(express.session({secret: "totally salty man!!!!",
                              maxAge: new Date(Date.now() + 604800*1000),
                              store: new redisStore({ "client": client}) }));
    site.use(passport.initialize());
    site.use(passport.session());
    site.use(express.bodyParser());
    site.use(express.methodOverride());
    site.use(site.router);
});

/**  Routes/Views  **/
site.get('/', function(req, res, next){
    res.render("index.html");
});

// Get all the subdomains!
site.get('/subdomains', function(req, res, next){
    // See how long this takes
    var timer = new Date();
    // Save the assembled records
    var recordsAssembly = [];

    // Use async queue to do this
    var q = async.queue(function (domain, callback) {
        console.log('calling namecheap and asking about ' + domain.name);
        namecheap.domains.dns.getHosts(domain.name, function(err, res) {
            if (err){
                console.log(err);
                callback(true, err);
            }else{
                console.log(err);
                recordsAssembly.push(res);
                callback(false, res);
            }
        });
        
    }, 4); // this number is concurrency, (how many HTTP threads to open at once)
    
    // Assign the queue callback
    q.drain = function() {
        console.log('all items have been processed, returning!');
        console.log("done in: " + ( new Date() - timer ) + "ms");
        res.json(recordsAssembly);
    };
    var enabledDomains = settings.ENABLED_DOMAINS;
    // Loop over our domains and get their records
    for (var domain in enabledDomains){
        q.push({"name": enabledDomains[domain]}, function (err, hostRecords) {
            if (err){
                console.error(hostRecords);
            }
        });
    }
});

// Set a new subdomain!
site.post('/subdomain', function(req, res, next){
    res.json({"error": "coming soon"});
});

// Delete a subdomain!
site.delete('/subdomain/:domain', function(req, res, next){
    res.json({"error": "coming soon"});
});

//Catch all other attempted routes and throw them a 404!
site.all('*', function(req, resp, next){
    next({name: "NotFound", "message": "Oops! The page you requested doesn't exist","status": 404});
});

/*
*
**  Server startup
*
*/
//Foreman will set the proper port for live mode, otherwise use port 8888
var port = settings.PORT || 8888;
site.listen(port);
console.log("Server listening to http://" + site.get('domain'));
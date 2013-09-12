/*
*   nc-subdomainer
*   Namecheap subdomain manager
*/

/**  Depends  **/
var express = require('express'),
    swig = require('swig'),
    Namecheap = require('namecheap'),namecheap,
    redis = require("redis"), client,
    async = require("async"),
    passport = require("passport"), domain,
    GitHubStrategy = require("passport-github").Strategy,
    site = module.exports = express();
var redisStore = require("connect-redis")(express);

if (!process.env.NCSUBDOMAIN){
    process.exit("Missing nc-subdomainer access domain name!")
}
if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_ID){
    process.exit("Missing Github creds!")
}

var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

var enabledDomains = ["viafoundry.com", "fiavoura.com", "viafourous.com"]; //, "fun-cooker.com", "cryptonectar.com"];

//Dev mode
site.configure('dev', function(){
    //Set your domain name for your development environment
    domain = process.env.NCSUBDOMAIN || "localhost";
    site.set('domain', domain);
    namecheap = new Namecheap('kishcom', 'GET_API_KEY', '141.117.10.153'); // 141.117.10.153 is fiavoura.com ... my local VM. IPs must be registered with namecheap
    client = redis.createClient();
    site.use(express.logger('dev'));
    console.log("Running in dev mode");
});
//Live deployed mode
site.configure('live', function(){
    domain = process.env.NCSUBDOMAIN || "localhost";
    //Set your live domain name here
    site.set('domain', 'viafoundry.com');
    namecheap = new Namecheap('kishcom', 'GET_API_KEY', '141.117.10.40'); // 141.117.10.40 is hal.viafoura.com ... Jenkins/Hal-hubot/selenium live here too!
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
    client.get()
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
        recordsAssembly.push({"domain": domain.name, "records": [ {"www": "something"}, {"www4": "somethingelse"}, ]});
        callback(false, "testing!");
        // Uncomment when you get an api key
        /*namecheap.domains.dns.getHosts(domain.name, function(err, res) {
        console.log(res);
        recordsAssembly.push(res);
        if (err){
            callback(true, err);
        }else{
            callback(false, res);
        }
        });*/
        
    }, 4); // this number is concurrency, (how many HTTP threads to open at once)
    
    // Assign the queue callback
    q.drain = function() {
        console.log('all items have been processed, returning!');
        console.log("done in: " + ( new Date() - timer ) + "ms");
        res.json(recordsAssembly);
    }

    // Loop over our domains and get their records
    for (var domain in enabledDomains){
        q.push({"name": enabledDomains[domain]}, function (err, hostRecords) {
            if (err){
                console.error(hostRecords);
            }else{
                console.log('Host records for ' + enabledDomains[domain] +' returned!');
                console.log(JSON.stringify(hostRecords));
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
var port = process.env.PORT || 8888;
site.listen(port);
console.log("Server listening to http://" + site.get('domain'));
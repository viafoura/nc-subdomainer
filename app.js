/*
*   nc-subdomainer
*   Namecheap subdomain manager
*/

/**  Depends  **/
var express = require('express'),
    swig = require('swig'),
    Namecheap = require('./namecheap'),
    redis = require("redis"), client,
    async = require("async"),
    settings = require("./settings").settings,
    passport = require("passport"), domain,
    GitHubStrategy = require("passport-github").Strategy,
    request = require("request"),
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
    callbackURL: "http://" + domain + "/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    var profileToken = "githubId" + profile.id;

    // Get their orgs and make sure they belong to the right one!
    //
    request({ url: "https://api.github.com/users/"+profile.username+"/orgs" }, function(err, resp, body){
        var orgs, found = false;
        try{
            orgs = JSON.parse(body);
        }catch(e){
            console.log("JSON parse error", e);
        }
        for (var i in orgs){
            console.log(orgs[i]);
            if (settings.GITHUB_ORG === orgs[i].login){
                found = true;
                break;
            }
        }
        if (found){
            console.log(profile.username + " is part of " + settings.GITHUB_ORG);
            client.get(profileToken, function(err, reply){
                if (err){
                    console.log(err);
                    return done(err, null);
                }else{
                    if (reply === null){
                        // No user found, create them, store the whole profile
                        client.set(profileToken, JSON.stringify( profile ));
                        return done(false, profile);
                    }else{
                        return done(false, JSON.parse(reply));
                    }
                }
            });
        }else{

            var message = profile.username + " is NOT a member of the '" + settings.GITHUB_ORG + "' organization. Make sure you are public: https://github.com/organizations/" + settings.GITHUB_ORG + "/publicize/" + profile.username + " .";
            console.log(message);
            return done(message, null);
        }
    });
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
    site.use(express.session({secret: "WHOA totally salty mang!?!!!!",
                              maxAge: new Date(Date.now() + 604800*1000),
                              store: new redisStore({ "client": client}) }));
    site.use(passport.initialize());
    site.use(passport.session());
    site.use(express.bodyParser());
    site.use(express.methodOverride());
    site.use(site.router);
});


/** Routes/Views **/
site.get('/', ensureAuthenticated, function(req, res, next){
    res.render("index.html", {"domain": settings.NCSUBDOMAIN,
                              "enabledDomains": settings.ENABLED_DOMAINS,
                              "user": req.user});
});



// Github Auth
site.get('/auth/github',
        passport.authenticate('github'),
        // The request will be redirected to GitHub for authentication, so this function will not be called.
        function(req, res){ }
);
site.get('/auth/github/callback',
        passport.authenticate('github', { failureRedirect: '/login' }),
        function(req, res) { res.redirect('/'); }
);
site.get('/login', function(req, res){
    res.render('login', { user: req.user, "githuborg": settings.GITHUB_ORG });
});
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login');
}


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
                // Namecheap API is weird. You have to send/request all subdomains be updated when you just want to add one
                // So we store the response of what records a domain has to send back to Namecheap when setting a domain
                client.set(domain.name, JSON.stringify(res));
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
    var error = "";
    var found = false;
    for (var i in settings.ENABLED_DOMAINS){
        if (settings.ENABLED_DOMAINS[i] === req.body.domain){
            found = true;
            break;
        }
    }
    if (!found){
        error = "Bad domain!";
    }
    if (req.body.subdomaintype !== "CNAME" &&
        req.body.subdomaintype !== "A" &&
        req.body.subdomaintype !== "URL301" ){
        error = "Bad direction type!";
    }
    if (!req.body.dest){
        error = "Bad or missing destination.";
    }

    if (error !== ""){
        res.json({"error": error});
    }else{
        var domainHostRecords = [{  HostName: req.body.subdomain,
                                    RecordType: req.body.subdomaintype,
                                    Address: req.body.dest,
                                    TTL: settings.DNS_TTL }
                                ];
        client.get(req.body.domain, function(err, reply) {
                // reply is null when the key is missing
                if (reply !== null){
                    reply = JSON.parse(reply);
                }
                
                var currentHostRecords = reply.DomainDNSGetHostsResult.host;
                // Look over current hosts, if we find the subdomain we're going to add, don't add it (it's already in domainHostRecords)
                for (var record in currentHostRecords){
                    if (currentHostRecords[record].Name !== req.body.subdomain){
                        // Weird that Namecheap's API getter/setting names don't line up :\
                        var updateThis = {  HostName: currentHostRecords[record].Name,
                                            RecordType: currentHostRecords[record].Type,
                                            Address: currentHostRecords[record].Address,
                                            TTL: currentHostRecords[record].TTL };

                        domainHostRecords.push(updateThis);
                    }
                }
                //console.log(req.body.domain, domainHostRecords);
                namecheap.domains.dns.setHosts(req.body.domain, domainHostRecords,
                function(err, ncres) {
                    if (err){
                        console.log(err);
                        res.json({"error": err});
                    }else{
                        console.log(ncres);
                        if (ncres.DomainDNSSetHostsResult.IsSuccess === true){
                            res.json({"error": false, "message": "Subdomain added!"});
                        }else{
                            res.json({"error": true, "message": "Unexpected response."});
                        }
                    }
                });
            });
    }
});

// Delete a subdomain! (What does "DRY" mean anyways?)
site.delete('/subdomain', function(req, res, next){
    var error = "";
    var found = false;
    for (var i in settings.ENABLED_DOMAINS){
        if (settings.ENABLED_DOMAINS[i] === req.body.domain){
            found = true;
            break;
        }
    }
    if (!found){
        error = "Bad domain!";
    }

    if (error !== ""){
        res.json({"error": error});
    }else{
        var domainHostRecords = [];
        client.get(req.body.domain, function(err, reply) {
                // reply is null when the key is missing
                if (reply !== null){
                    reply = JSON.parse(reply);
                }
                
                var currentHostRecords = reply.DomainDNSGetHostsResult.host;
                // Look over current hosts, if we find the subdomain we're going to remove, don't add it (obviously)
                for (var record in currentHostRecords){
                    if (currentHostRecords[record].Name !== req.body.subdomain){
                        // Weird that Namecheap's API getter/setting names don't line up :\
                        var updateThis = {  HostName: currentHostRecords[record].Name,
                                            RecordType: currentHostRecords[record].Type,
                                            Address: currentHostRecords[record].Address,
                                            TTL: currentHostRecords[record].TTL };

                        domainHostRecords.push(updateThis);
                    }
                }

                namecheap.domains.dns.setHosts(req.body.domain, domainHostRecords,
                function(err, ncres) {
                    if (err){
                        res.json({"error": err});
                    }else{
                        if (ncres.DomainDNSSetHostsResult.IsSuccess === true){
                            res.json({"error": false, "message": "Subdomain removed!"});
                        }else{
                            res.json({"error": true, "message": "Unexpected response."});
                        }
                    }
                });
            });
    }
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
console.log("Server listening to http://" + site.get('domain') + " on port " + port);
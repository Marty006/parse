const express        = require('express');
const ParseServer    = require('parse-server').ParseServer;
const S3Adapter      = require('parse-server').S3Adapter;
const expressLayouts = require('express-ejs-layouts');
const bodyParser     = require('body-parser');
const cookieParser   = require('cookie-parser');
const methodOverride = require('method-override');
const cookieSession  = require('cookie-session');

// Parse configuration
const databaseUri = process.env.DATABASE_URI || process.env.MONGOLAB_URI;
const serverUrl   = process.env.SERVER_URL || 'http://localhost:1337/parse';
const appId       = process.env.APP_ID || 'myAppId';
const masterKey   = process.env.MASTER_KEY || 'myMasterKey';
const restApiKey  = process.env.MASTER_REST_KEY ||'myRestApiKey';
const appName     = process.env.APP_NAME ||'nearme';

// Mailgun configuration
const apiKey      = process.env.MAILGUN_API_KEY || 'YOUR_MAILGUN_API_KEY';
const domain      = process.env.MAILGUN_DOMAIN || 'YOUR_MAILGUN_DOMAIN';
const fromAddress = process.env.MAILGUN_FROM_ADDRESS || 'QuanLabs <dev@quanlabs.com>';

// AWS S3 configuration
const accessKeyId     = process.env.AWS_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY';
const bucketName      = process.env.BUCKET_NAME || 'YOUR_AWS_BUCKET_NAME';

if (!databaseUri) {
    console.log('DATABASE_URI not specified, falling back to localhost.');
}

const api = new ParseServer({
    databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
    cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
    appId: appId,
    masterKey: masterKey,
    serverURL: serverUrl,
    restAPIKey: restApiKey,
    verifyUserEmails: false,
    publicServerURL: serverUrl,
    appName: appName,
    emailAdapter: {
        module: 'parse-server-simple-mailgun-adapter',
        options: {
            fromAddress: fromAddress,
            domain: domain,
            apiKey: apiKey,
        }
    },
    filesAdapter: new S3Adapter(
        accessKeyId,
        secretAccessKey,
        bucketName,
        {directAccess: true}
    ),
});

const app = express();

app.set('view engine', 'ejs');
app.set('views', 'views');

// Serve the Parse API on the /parse URL prefix
const mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

app.use(express.static('public'));
app.use(expressLayouts);
app.use(cookieParser());
app.use(methodOverride());

app.use(cookieSession({
    name: 'photogram.sess',
    secret: 'SECRET_SIGNING_KEY',
    maxAge: 15724800000
}));

app.use(function (req, res, next) {
    res.locals.user      = req.session.user;
    res.locals.page      = req.url.split('/').pop();
    res.locals.appId     = appId;
    res.locals.serverUrl = serverUrl;
    next();
});

var isNotInstalled = function (req, res, next) {

    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Admin');
    query.first().then(function (adminRole) {

        if (!adminRole) {
            return Parse.Promise.error({
                message: 'Admin Role not found',
                code: 5000
            });
        }

        var userRelation = adminRole.relation('users');
        return userRelation.query().count({useMasterKey: true});
    }).then(function (count) {

        if (count === 0) {
            next();
        } else {
            req.session = null;
            res.redirect('/login');
        }
    }, function (error) {
        if (error.code === 5000) {
            next();
        } else {
            req.session = null;
            res.redirect('/login');
        }
    })
}

var isAdmin = function (req, res, next) {

    var objUser;

    return Parse.Cloud.httpRequest({
        url: serverUrl + '/users/me',
        headers: {
            'X-Parse-Application-Id': appId,
            'X-Parse-REST-API-Key': restApiKey,
            'X-Parse-Session-Token': req.session.token
        }
    }).then(function (userData) {

        objUser = Parse.Object.fromJSON(userData.data);

        var query = new Parse.Query(Parse.Role);
        query.equalTo('name', 'Admin');
        query.equalTo('users', objUser);
        return query.first();

    }).then(function (isAdmin) {

        if (!isAdmin) {
            return Parse.Promise.error();
        }

        req.user = objUser;
        return next();

    }).then(null, function () {
        req.session = null;
        res.redirect('/login');
    });
}

var isNotAuthenticated = function (req, res, next) {

    Parse.Cloud.httpRequest({
        url: serverUrl + '/users/me',
        headers: {
            'X-Parse-Application-Id': appId,
            'X-Parse-REST-API-Key': restApiKey,
            'X-Parse-Session-Token': req.session.token
        }
    }).then(function (userData) {
        res.redirect('/dashboard/places');
    }, function (error) {
        next();
    });
}

var urlencodedParser = bodyParser.urlencoded({extended: false});

app.get('/install', isNotInstalled, function (req, res) {
    res.render('install');
});

app.post('/install', [urlencodedParser, isNotInstalled], function (req, res) {

    var name                 = req.body.name.trim();
    var username             = req.body.username.toLowerCase().trim();
    var password             = req.body.password.trim();
    var passwordConfirmation = req.body.passwordConfirmation.trim();

    if (!name) {
        return res.render('install', {
            flash: 'Name is required',
            input: req.body
        });
    }

    if (!username) {
        return res.render('install', {
            flash: 'Email is required',
            input: req.body
        });
    }

    if (password !== passwordConfirmation) {
        return res.render('install', {
            flash: "Password doesn't match",
            input: req.body
        });
    }

    if (password.length < 6) {
        return res.render('install', {
            flash: 'Password should be at least 6 characters',
            input: req.body
        });
    }

    var roles = [];

    var roleACL = new Parse.ACL();
    roleACL.setPublicReadAccess(true);

    var role = new Parse.Role('Admin', roleACL);
    roles.push(role);
    var role = new Parse.Role('User', roleACL);
    roles.push(role);

    var user = new Parse.User();
    user.set('name', name);
    user.set('username', username);
    user.set('email', username);
    user.set('password', password);
    user.set('roleName', 'Admin');
    user.set('photoThumb', undefined);

    var query = new Parse.Query(Parse.Role);

    query.find().then(function (objRoles) {
        return Parse.Object.destroyAll(objRoles, {useMasterKey: true});
    }).then(function () {
        return Parse.Object.saveAll(roles);
    }).then(function () {
        return user.signUp();
    }).then(function (objUser) {
        objUser.setACL(new Parse.ACL(objUser));
        objUser.save(null, {useMasterKey: true});
        req.session.user  = objUser;
        req.session.token = objUser.getSessionToken();
        res.redirect('/dashboard/places');
    }, function (error) {
        res.render('install', {
            flash: error.message,
            input: req.body
        });
    });
});

app.get('/', function (req, res) {
    res.redirect('/login');
});

app.get('/login', isNotAuthenticated, function (req, res) {
    res.render('login');
});

app.get('/reset-password', isNotAuthenticated, function (req, res) {
    res.render('reset-password');
});

app.get('/dashboard/places', isAdmin, function (req, res) {
    res.render('places');
});

app.get('/dashboard/categories', isAdmin, function (req, res) {
    res.render('categories');
});

app.get('/dashboard/users', isAdmin, function (req, res) {
    res.render('users');
});

app.get('/dashboard/reviews', isAdmin, function (req, res) {
    res.render('reviews');
});

// Logs in the user
app.post('/login', [urlencodedParser, isNotAuthenticated], function (req, res) {

    var username = req.body.username;
    var password = req.body.password;

    Parse.User.logIn(username, password).then(function (user) {

        var query = new Parse.Query(Parse.Role);
        query.equalTo('name', 'Admin');
        query.equalTo('users', user);
        query.first().then(function (isAdmin) {

            if (!isAdmin) {
                res.render('login', {
                    flash: 'Not Authorized'
                });
            } else {
                req.session.user  = user;
                req.session.token = user.getSessionToken();
                res.redirect('/dashboard/places');
            }

        }, function (error) {
            res.render('login', {
                flash: error.message
            });
        });
    }, function (error) {
        res.render('login', {
            flash: error.message
        });
    });
});

app.get('/logout', isAdmin, function (req, res) {
    req.session = null;
    res.redirect('/login');
});

var port = process.env.PORT || 1337;
app.listen(port, function () {
    console.log('Parse server running on port ' + port + '.');
});

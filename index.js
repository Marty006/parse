'use strict';
const express     = require('express');
const ParseServer = require('parse-server').ParseServer;
const S3Adapter   = require('parse-server').S3Adapter;
const bodyParser     = require('body-parser');
const cookieParser   = require('cookie-parser');
const methodOverride = require('method-override');
const cookieSession  = require('cookie-session');
const path           = require('path');

// Parse configuration
const databaseUri = process.env.DATABASE_URI || process.env.MONGOLAB_URI;
const serverUrl   = process.env.SERVER_URL || 'http://localhost:1337/parse';
const appId       = process.env.APP_ID || 'myAppId';
const masterKey   = process.env.MASTER_KEY || 'myMasterKey';
const restApiKey  = process.env.MASTER_REST_KEY || 'myRestApiKey';
const appName     = process.env.APP_NAME || 'nearme';

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

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));


// Serve the Parse API on the /parse URL prefix
const mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

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
    query.first()
         .then(adminRole=> {

             if (!adminRole) {
                 return Parse.Promise.error({
                     message: 'Admin Role not found',
                     code: 5000
                 });
             }

             let userRelation = adminRole.relation('users');
             return userRelation.query().count({useMasterKey: true});
         })
         .then(count=> {
             if (count === 0) {
                 next();
             } else {
                 req.session = null;
                 res.redirect('/login');
             }
         }, error=> {
             if (error.code === 5000) {
                 next();
             } else {
                 req.session = null;
                 res.redirect('/login');
             }
         })
}

var urlencodedParser = bodyParser.urlencoded({extended: false});


app.post('/install', [urlencodedParser, isNotInstalled], (req, res) => {

    let name                 = req.body.name.trim();
    let username             = req.body.username.toLowerCase().trim();
    let password             = req.body.password.trim();
    let passwordConfirmation = req.body.passwordConfirmation.trim();

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

    let roleACL = new Parse.ACL();
    roleACL.setPublicReadAccess(true);

    var role = new Parse.Role('Admin', roleACL);
    roles.push(role);
    var role = new Parse.Role('User', roleACL);
    roles.push(role);

    let user = new Parse.User();
    user.set('name', name);
    user.set('username', username);
    user.set('email', username);
    user.set('password', password);
    user.set('roleName', 'Admin');
    user.set('photoThumb', undefined);

    let query = new Parse.Query(Parse.Role);

    query.find()
         .then(objRoles=>Parse.Object.destroyAll(objRoles, {useMasterKey: true}))
         .then(()=>Parse.Object.saveAll(roles))
         .then(()=>user.signUp())
         .then(objUser=> {
             objUser.setACL(new Parse.ACL(objUser));
             objUser.save(null, {useMasterKey: true});
             req.session.user  = objUser;
             req.session.token = objUser.getSessionToken();
             res.redirect('/dashboard/places');
         }, error=> {
             res.render('install', {
                 flash: error.message,
                 input: req.body
             });
         });
});

// Parse Server plays nicely with the rest of your web routes
app.get('/', function (req, res) {
    res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});


var port = process.env.PORT || 1337;
app.listen(port, function () {
    console.log('Parse server running on port ' + port + '.');
});

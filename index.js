'use strict';
const express        = require('express');
const ParseServer    = require('parse-server').ParseServer;
const S3Adapter      = require('parse-server').S3Adapter;
const bodyParser     = require('body-parser');
const cookieParser   = require('cookie-parser');
const methodOverride = require('method-override');
const cookieSession  = require('cookie-session');
const ParseDashboard = require('parse-dashboard');
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

// Push OneSignal
const OneSignalPushAdapter = require('parse-server-onesignal-push-adapter');

var oneSignalPushAdapter = new OneSignalPushAdapter({
    oneSignalAppId: process.env.ONE_SIGNAL_APP_ID || "your-one-signal-app-id",
    oneSignalApiKey: process.env.ONE_SIGNAL_REST_API_KEY || "your-one-signal-api-key"
});
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
    push: {
        adapter: oneSignalPushAdapter
    },
});

var dashboard = new ParseDashboard({
    "apps": [
        {
            "serverURL": serverUrl,
            "appId": appId,
            "masterKey": masterKey,
            "appName": appName,
            "iconName": "icon.png"
        }
    ],
    "iconsFolder": "public/assets/images"
});

const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// make the Parse Dashboard available at /dashboard
app.use('/dashboard', dashboard);

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


// Parse Server plays nicely with the rest of your web routes
app.get('/', function (req, res) {
    res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});


var port = process.env.PORT || 1337;
app.listen(port, function () {
    console.log('Parse server running on port ' + port + '.');
});

'use strict';
const express        = require('express');
const cors           = require('cors');
const ParseServer    = require('parse-server').ParseServer;
const ParseDashboard = require('parse-dashboard');
const path           = require('path');

// Jade
const expressLayouts = require('express-ejs-layouts');
// Parse configuration
const port           = process.env.PORT || 1337;
// MongoDB
const databaseUri    = process.env.DATABASE_URI || process.env.MONGOLAB_URI;
//AppData
const serverUrl      = process.env.SERVER_URL;
const appId          = process.env.APP_ID;
const masterKey      = process.env.MASTER_KEY;
const restApiKey     = process.env.MASTER_REST_KEY;
const appName        = process.env.APP_NAME;

const DASHBOARD_USER     = process.env.DASHBOARD_USER;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;


if (!databaseUri) {
    console.log('DATABASE_URI not specified, falling back to localhost.');
}

let ServerConfig = {
    databaseURI     : databaseUri || 'mongodb://localhost:27017/photogram',
    cloud           : './cloud/main.js',
    appId           : appId,
    masterKey       : masterKey,
    serverURL       : serverUrl,
    restAPIKey      : restApiKey,
    verifyUserEmails: false,
    publicServerURL : serverUrl,
    appName         : appName,
    //liveQuery       : {
    //    classNames: ['GalleryComment']
    //},
};


if (process.env.AWS_ACCESS_KEY_ID) {
    // AWS S3 configuration
    const S3accessKeyId       = process.env.AWS_ACCESS_KEY_ID;
    const S3secretAccessKey   = process.env.AWS_SECRET_ACCESS_KEY;
    const S3bucketName        = process.env.BUCKET_NAME;
    const S3Adapter           = require('parse-server').S3Adapter;
    ServerConfig.filesAdapter = new S3Adapter(
        S3accessKeyId,
        S3secretAccessKey,
        S3bucketName,
        {directAccess: true}
    );
}


if (process.env.MAILGUN_API_KEY) {
    // Mailgun configuration
    const MailgunApiKey       = process.env.MAILGUN_API_KEY;
    const MailgunDomain       = process.env.MAILGUN_DOMAIN;
    const MailgunFromAddress  = process.env.MAILGUN_FROM_ADDRESS;
    ServerConfig.emailAdapter = {
        module : 'parse-server-simple-mailgun-adapter',
        options: {
            apiKey     : MailgunApiKey,
            fromAddress: MailgunFromAddress,
            domain     : MailgunDomain,
        }
    };
}


if (process.env.ONE_SIGNAL_APP_ID) {
    // Push OneSignal
    const OneSignalAppId  = process.env.ONE_SIGNAL_APP_ID;
    const OneSignalApiKey = process.env.ONE_SIGNAL_REST_API_KEY;

    const OneSignalPushAdapter = require('parse-server-onesignal-push-adapter');
    ServerConfig.push          = {
        adapter: new OneSignalPushAdapter({
            oneSignalApiKey: OneSignalApiKey,
            oneSignalAppId : OneSignalAppId,
        })
    };
}


const api       = new ParseServer(ServerConfig);
const dashboard = new ParseDashboard({
    apps       : [
        {
            appName  : appName,
            serverURL: serverUrl,
            appId    : appId,
            masterKey: masterKey,
            iconName : 'icon.png'
        }
    ],
    users      : [
        {
            user: DASHBOARD_USER, // Used to log in to your Parse Dashboard
            pass: DASHBOARD_PASSWORD
        }
    ],
    iconsFolder: 'views/assets/images'
}, true);

const app = express();

// Cors
app.use(cors());

// EJS Template
app.set('view engine', 'ejs');
app.use(express.static('views'));
app.use((req, res, next) => {
    res.locals.appId     = appId;
    res.locals.serverUrl = serverUrl;
    next();
});

app.get('/', function (req, res) {
    res.render('index');
});

// Serve the Parse API on the /parse URL prefix
const mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);


// make the Parse Dashboard available at /dashboard
app.use('/dashboard', dashboard);


var httpServer = require('http').createServer(app);
httpServer.listen(port, function () {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
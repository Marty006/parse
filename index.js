'use strict';
const express              = require('express');
const cors                 = require('cors');
const ParseServer          = require('parse-server').ParseServer;
const ParseDashboard       = require('parse-dashboard');
const expressLayouts       = require('express-ejs-layouts');
const path                 = require('path');
const OneSignalPushAdapter = require('parse-server-onesignal-push-adapter');
const FSFilesAdapter       = require('parse-server-fs-adapter');
const S3Adapter            = require('parse-server').S3Adapter;

// Parse configuration
// Parse configuration
const port        = process.env.PORT || 1337;
const databaseUri = process.env.DATABASE_URI || process.env.MONGOLAB_URI;
const serverUrl   = process.env.SERVER_URL || 'http://localhost:1337/parse';
const appId       = process.env.APP_ID || 'myAppId';
const masterKey   = process.env.MASTER_KEY || 'myMasterKey';
const restApiKey  = process.env.MASTER_REST_KEY || 'myRestApiKey';
const appName     = process.env.APP_NAME || 'photogram';

// Database Ecosystem file
if (!process.env.DATABASE_URI) {
    console.log('DATABASE_URI not specified, falling back to localhost.');
}

let ServerConfig = {
    databaseURI     : databaseUri || 'mongodb://localhost:27017/dev',
    cloud           : process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
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

// File Local
if (process.env.UPLOAD_LOCAL_PATH) {
    ServerConfig.filesAdapter = new FSFilesAdapter({
        filesSubDirectory: process.env.UPLOAD_LOCAL_PATH
    });
}

// AWS S3 configuration
if (process.env.AWS_ACCESS_KEY_ID) {
    ServerConfig.filesAdapter = new S3Adapter(
        process.env.AWS_ACCESS_KEY_ID,
        process.env.AWS_SECRET_ACCESS_KEY,
        process.env.BUCKET_NAME,
        {directAccess: true}
    );
}


// Mailgun configuration
if (process.env.MAILGUN_API_KEY) {
    ServerConfig.emailAdapter = {
        module : 'parse-server-simple-mailgun-adapter',
        options: {
            apiKey     : process.env.MAILGUN_API_KEY,
            fromAddress: process.env.MAILGUN_DOMAIN,
            domain     : process.env.MAILGUN_FROM_ADDRESS,
        }
    };
}


// Push OneSignal
if (process.env.ONE_SIGNAL_APP_ID) {
    ServerConfig.push = {
        adapter: new OneSignalPushAdapter({
            oneSignalApiKey: process.env.ONE_SIGNAL_APP_ID,
            oneSignalAppId : process.env.ONE_SIGNAL_REST_API_KEY,
        })
    };
}

console.log('ServerConfig', ServerConfig);

// Start Parse Server
const api = new ParseServer(ServerConfig);
const app = express();
app.use(expressLayouts);

// Cors
app.use(cors());

// EJS Template
app.set('view engine', 'ejs');
app.use(express.static('views'));

app.use((req, res, next) => {
    res.locals.appId     = process.env.APP_ID;
    res.locals.serverUrl = process.env.SERVER_URL;
    next();
});

app.get('/', (req, res) => res.render('index'));

// Serve the Parse API on the /parse URL prefix
const mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Dashboard
if (process.env.DASHBOARD_USER) {
    const DASHBOARD_USER     = process.env.DASHBOARD_USER;
    const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
    const dashboard          = new ParseDashboard({
        apps       : [
            {
                appName  : process.env.APP_NAME,
                serverURL: process.env.SERVER_URL,
                appId    : process.env.APP_ID,
                masterKey: process.env.MASTER_KEY,
                iconName : 'icon.png'
            }
        ],
        users      : [
            {
                user: DASHBOARD_USER, // Used to log in to your Parse Dashboard
                pass: DASHBOARD_PASSWORD
            }
        ],
        iconsFolder: 'icons'
    }, true);

    // make the Parse Dashboard available at /dashboard
    app.use(process.env.DASHBOARD_URL, dashboard);
}

const httpServer = require('http').createServer(app);
httpServer.listen(port, () => console.log('parse-server-example running on port ' + port + '.'));

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
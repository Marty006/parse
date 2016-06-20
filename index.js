'use strict';
const express              = require('express');
const cors                 = require('cors');
const ParseServer          = require('parse-server').ParseServer;
const S3Adapter            = require('parse-server').S3Adapter;
const ParseDashboard       = require('parse-dashboard');
const OneSignalPushAdapter = require('parse-server-onesignal-push-adapter');
const path                 = require('path');
// Parse configuration
const port                 = process.env.PORT || 1337;
const databaseUri          = process.env.DATABASE_URI || process.env.MONGOLAB_URI;
const serverUrl            = process.env.SERVER_URL || 'http://localhost:1337/parse';
const appId                = process.env.APP_ID || 'myAppId';
const masterKey            = process.env.MASTER_KEY || 'myMasterKey';
const restApiKey           = process.env.MASTER_REST_KEY || 'myRestApiKey';
const appName              = process.env.APP_NAME || 'photogram';
// Mailgun configuration
const apiKey               = process.env.MAILGUN_API_KEY || 'YOUR_MAILGUN_API_KEY';
const domain               = process.env.MAILGUN_DOMAIN || 'YOUR_MAILGUN_DOMAIN';
const fromAddress          = process.env.MAILGUN_FROM_ADDRESS || 'QuanLabs <dev@quanlabs.com>';
// AWS S3 configuration
const accessKeyId          = process.env.AWS_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID';
const secretAccessKey      = process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY';
const bucketName           = process.env.BUCKET_NAME || 'YOUR_AWS_BUCKET_NAME';
// Push OneSignal
const oneSignalAppId       = process.env.ONE_SIGNAL_APP_ID || "your-one-signal-app-id";
const oneSignalApiKey      = process.env.ONE_SIGNAL_REST_API_KEY || "your-one-signal-api-key";


if (!databaseUri) {
    console.log('DATABASE_URI not specified, falling back to localhost.');
}

const api = new ParseServer({
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
    emailAdapter    : {
        module : 'parse-server-simple-mailgun-adapter',
        options: {
            fromAddress: fromAddress,
            domain     : domain,
            apiKey     : apiKey,
        }
    },
    filesAdapter    : new S3Adapter(
        accessKeyId,
        secretAccessKey,
        bucketName,
        {directAccess: true}
    ),
    push            : {
        adapter: new OneSignalPushAdapter({
            oneSignalAppId : oneSignalAppId,
            oneSignalApiKey: oneSignalApiKey
        })
    },
});

const dashboard = new ParseDashboard({
    apps       : [
        {
            appName  : appName,
            serverURL: serverUrl,
            appId    : appId,
            masterKey: masterKey,
            iconName : 'icon.png'
        },
        {
            appName  : 'Photogram Production',
            serverURL: 'https://photogramserver.herokuapp.com/parse',
            appId    : 'myAppId',
            masterKey: 'PhotogramKey123',
            iconName : 'icon.png'
        }
    ],
    users      : [
        {
            user: 'admin', // Used to log in to your Parse Dashboard
            pass: 'photogram123'
        }
    ],
    iconsFolder: 'www/assets/images'
}, true);

const app = express();

// Cors
app.use(cors());

// Public Folder
app.use('/', express.static(path.join(__dirname, '/www')));

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
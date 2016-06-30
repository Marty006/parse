'use strict';
const Install         = require('./class/Install');
const User            = require('./class/User');
const Gallery         = require('./class/Gallery');
const GalleryActivity = require('./class/GalleryActivity');
const GalleryComment  = require('./class/GalleryComment');
const Installation    = require('./class/Installation');
const Dashboard       = require('./class/Dashboard');


// Instalattion
Parse.Cloud.beforeSave(Installation.beforeSave);

// Install
Parse.Cloud.define('status', Install.status);
Parse.Cloud.define('install', Install.start);

// Admin Dashboard
Parse.Cloud.define('dashboard', Dashboard.home)

// GalleryActivity
Parse.Cloud.define('feedActivity', GalleryActivity.feed);

// User
Parse.Cloud.beforeSave(Parse.User, User.beforeSave);
Parse.Cloud.afterSave(Parse.User, User.afterSave);
//Parse.Cloud.afterDelete(Parse.User, User.afterDelete);

Parse.Cloud.define('findUserByUsername', User.findUserByUsername);
Parse.Cloud.define('findUserByEmail', User.findUserByEmail);
Parse.Cloud.define('profile', User.profile);
Parse.Cloud.define('followUser', User.follow);
Parse.Cloud.define('getFollowers', User.getFollowers);
Parse.Cloud.define('getFollowings', User.getFollowings);
Parse.Cloud.define('getUsers', User.getUsers);
Parse.Cloud.define('listUsers', User.listUsers);
Parse.Cloud.define('createUser', User.createUser);
Parse.Cloud.define('updateUser', User.updateUser);
Parse.Cloud.define('destroyUser', User.destroyUser);
Parse.Cloud.define('saveFacebookPicture', User.saveFacebookPicture);
Parse.Cloud.define('validateUsername', User.validateUsername);
Parse.Cloud.define('validateEmail', User.validateEmail);

// Gallery
Parse.Cloud.beforeSave('Gallery', Gallery.beforeSave);
Parse.Cloud.afterSave('Gallery', Gallery.afterSave);
Parse.Cloud.afterDelete('Gallery', Gallery.afterDelete);
Parse.Cloud.define('feedGallery', Gallery.feed);
Parse.Cloud.define('commentGallery', Gallery.commentGallery);
Parse.Cloud.define('likeGallery', Gallery.likeGallery);
Parse.Cloud.define('isGalleryLiked', Gallery.isGalleryLiked);

// GalleryComment
Parse.Cloud.beforeSave('GalleryComment', GalleryComment.beforeSave);
Parse.Cloud.afterSave('GalleryComment', GalleryComment.afterSave);



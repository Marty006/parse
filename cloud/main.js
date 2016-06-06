'use strict';
const Install  = require('./class/install');
const User     = require('./class/user');
const Gallery  = require('./class/gallery');
const Category = require('./class/category');
const Comment  = require('./class/comment');

// Install
Parse.Cloud.define('status', Install.status);
Parse.Cloud.define('install', Install.start);

// User
Parse.Cloud.beforeSave(Parse.User, User.beforeSave);
Parse.Cloud.afterSave(Parse.User, User.afterSave);
Parse.Cloud.define('findUserByEmail', User.findUserByEmail);
Parse.Cloud.define('getUsers', User.getUsers);
Parse.Cloud.define('createUser', User.createUser);
Parse.Cloud.define('updateUser', User.updateUser);
Parse.Cloud.define('destroyUser', User.destroyUser);
Parse.Cloud.define('saveFacebookPicture', User.saveFacebookPicture);

// Gallery
Parse.Cloud.beforeSave('Gallery', Gallery.beforeSave);
Parse.Cloud.define('isGalleryLiked', Gallery.isGalleryLiked);
Parse.Cloud.define('likeGallery', Gallery.likeGallery);

//Category
Parse.Cloud.beforeSave('Category', Category.beforeSave);

// Comment
Parse.Cloud.beforeSave('Comment', Comment.beforeSave);
Parse.Cloud.afterSave('Comment', Comment.afterSave);

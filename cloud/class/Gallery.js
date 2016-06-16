'use strict';
const _               = require('lodash');
const Image           = require('./../helpers/image');
const User            = require('./../class/User');
const GalleryActivity = require('./../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('Gallery');

module.exports = {
    beforeSave    : beforeSave,
    afterSave     : afterSave,
    afterDelete   : afterDelete,
    feed          : feed,
    isGalleryLiked: isGalleryLiked,
    likeGallery   : likeGallery,
};

function afterDelete(req, res) {
    new Parse.Query('GalleryComment')
        .equalTo('gallery', req.object)
        .find({
            success: comments=> {
                Parse.Object.destroyAll(comments, {
                    success: ()=> {},
                    error  : error =>console.error("Error deleting related comments " + error.code + ": " + error.message)
                });
            },
            error  : error=>console.error("Error finding related comments " + error.code + ": " + error.message)
        });
}


function beforeSave(req, res) {
    const post = req.object;
    const user = req.user || req.object.get('user');

    //const isMasterKey = req.master;

    //if (!gallery.existed()) {
    //    var acl = new Parse.ACL();
    //    acl.setPublicReadAccess(true);
    //    acl.setRoleWriteAccess('Admin', true);
    //    acl.setWriteAccess(user, true);
    //    gallery.setACL(acl);
    //}

    //if (isMasterKey) {
    //    return res.success();
    //}

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!post.get('image')) {
        return res.error('Upload the first image');
    }

    if (!post.get('title')) {
        return res.error('Need image title');
    }

    if (!post.dirty('image')) {
        return res.success();
    }
    // Like

    //https://parse.com/docs/js/guide#performance-implement-efficient-searches
    let toLowerCase = w => w.toLowerCase();
    var words       = post.get('title').split(/\b/);
    words           = _.map(words, toLowerCase);
    var stopWords   = ['the', 'in', 'and']
    words           = _.filter(words, w=> w.match(/^\w+$/) && !_.includes(stopWords, w));
    var hashtags    = post.get('title').match(/#.+?\b/g);
    hashtags        = _.map(hashtags, toLowerCase)

    post.set('words', words);
    post.set('hashtags', hashtags);

    // User by
    post.set('user', user);

    post.set('isApproved', true);

    // Resize Image
    var imageUrl = post.get('image').url();

    Image.resize(imageUrl, 640, 640).then(function (base64) {
        return Image.saveImage(base64);
    }).then(function (savedFile) {
        post.set('image', savedFile);
        return Image.resize(imageUrl, 160, 160);
    }).then(function (base64) {
        return Image.saveImage(base64);
    }).then(function (savedFile) {
        post.set('imageThumb', savedFile);
        res.success();
    }, function (error) {
        res.error(error.message);
    });
}

function afterDelete(req, res) {
    var query = new Parse.Query('GalleryComment');
    query.equalTo('gallery', req.user);

    query.find().then(results=> {
        // Collect one promise for each delete into an array.
        let promises = [];
        _.each(results, result =>promises.push(result.destroy()));
        // Return a new promise that is resolved when all of the deletes are finished.
        return Parse.Promise.when(promises);

    }).then({
        success: res.success,
        error  : req.error
    });
}

function afterSave(req, res) {
    const user   = req.user;
    let activity = {
        action  : 'add photo',
        fromUser: user,
        gallery : req.object
    };
    console.log(activity);
    GalleryActivity.create(activity);
    User.incrementGallery(req.user);
}

function feed(req, res, next) {
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 10;

    console.log('Start Feed', req.params);

    let _query = new Parse.Query(ParseObject);

    _query
        .equalTo('isApproved', true)
        .descending('createdAt')
        .limit(_limit)
        .skip((_page * _limit) - _limit);

    let queryFind  = _query.find();
    let queryCount = _query.count();

    new Parse.Promise.when(queryFind, queryCount)
        .then((data, total)=> {
            let _result = {
                total: total,
                rows : []
            };

            if (!data.length) {
                res.error(true);
            }

            let cb = _.after(data.length, ()=> {
                res.success(_result);
            });

            _.each(data, item=> {

                let userGet = item.get('user');
                new Parse.Query('UserData').equalTo('user', userGet).first().then(user=> {

                    let obj = {
                        galleryObj   : item,
                        createdAt    : item.get('createdAt'),
                        image        : item.get('image'),
                        imageThubm   : item.get('imageThubm'),
                        title        : item.get('title'),
                        commentsTotal: item.get('commentsTotal') || 0,
                        likesTotal   : item.get('likesTotal') || 0,
                        user         : {
                            userObj: user,
                            id     : user.id,
                            name   : user.get('name'),
                            status : user.get('status'),
                            photo  : user.get('photo')
                        }
                    };
                    console.log('Obj', obj);

                    // Comments
                    _result.rows.push(obj);
                    cb();
                }, err=>console.log);

            });


        }, error=> res.error(error.message));
}


function likeGallery(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;


    if (!user) {
        return res.error('Not Authorized');
    }
    console.log('Like Gallery', user, galleryId);

    var objGallery;
    var response = {action: null};

    new Parse.Query('Gallery')
        .get(galleryId)
        .then(gallery => {
            return new Parse.Query('Gallery')
                .equalTo('likes', user)
                .equalTo('objectId', gallery)
                .find();
        })
        .then(result => {
            let relation = objGallery.relation('likes');

            if (result.length > 0) {
                objGallery.increment('likeCount', -1);
                relation.remove(user);
                response.action = 'unlike';
            } else {
                objGallery.increment('likeCount');
                relation.add(user);
                response.action = 'like';
            }
            return objGallery.save(null, {useMasterKey: true});
        })
        .then(() =>res.success(response), error=> res.error(error.message));
}

function isGalleryLiked(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    var query = new Parse.Query('Gallery');
    query.equalTo('likes', user);
    query.equalTo('objectId', galleryId);

    query.first({useMasterKey: true})
         .then(gallery=>res.success(gallery ? true : false), error=> res.error(error.message));
}


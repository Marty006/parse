'use strict';
const _               = require('lodash');
const Image           = require('./../helpers/image');
const User            = require('./../class/User');
const GalleryActivity = require('./../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('Gallery');
const UserFollow      = Parse.Object.extend('UserFollow');

module.exports = {
    beforeSave    : beforeSave,
    afterSave     : afterSave,
    afterDelete   : afterDelete,
    feed          : feed,
    commentGallery: commentGallery,
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
    const gallery = req.object;
    const user    = req.user || req.object.get('user');

    if (!user) {
        return res.error('Not Authorized');
    }

    //if (gallery.existed()) {
    //    if (!req.user) {
    //        return res.error('Not Authorized');
    //    }
    //}

    if (!gallery.get('image')) {
        return res.error('Upload the first image');
    }

    if (!gallery.get('title')) {
        return res.error('Need image title');
    }

    if (!gallery.dirty('image')) {
        return res.success();
    }
    // Like

    //https://parse.com/docs/js/guide#performance-implement-efficient-searches
    let toLowerCase = w => w.toLowerCase();
    var words       = gallery.get('title').split(/\b/);
    words           = _.map(words, toLowerCase);
    var stopWords   = ['the', 'in', 'and']
    words           = _.filter(words, w=> w.match(/^\w+$/) && !_.includes(stopWords, w));
    var hashtags    = gallery.get('title').match(/#.+?\b/g);
    hashtags        = _.map(hashtags, toLowerCase)

    gallery.set('words', words);
    gallery.set('hashtags', hashtags);

    // Set default values
    gallery.set('user', user);
    gallery.set('isApproved', true);
    gallery.set('followersTotal', 0);
    gallery.set('followingsTotal', 0);
    gallery.set('likesTotal', 0);
    gallery.set('galleriesTotal', 0);
    gallery.set('commentsTotal', 0);

    // Resize Image
    var imageUrl = gallery.get('image').url();

    console.log('Resize image', imageUrl);
    Image.resize(imageUrl, 640, 640).then(base64=> {
        return Image.saveImage(base64);
    }).then(savedFile=> {
        gallery.set('image', savedFile);
        return Image.resize(imageUrl, 160, 160);
    }).then(base64=> {
        return Image.saveImage(base64);
    }).then(savedFile => {
        gallery.set('imageThumb', savedFile);
        res.success();
    }, res.error);
}

function afterDelete(req, res) {
    let deleteComments = new Parse.Query('GalleryComment').equalTo('gallery', req.object).find().then(results=> {
        // Collect one promise for each delete into an array.
        let promises = [];
        _.each(results, result => {
            promises.push(result.destroy());
            User.decrementComment();
        });
        // Return a new promise that is resolved when all of the deletes are finished.
        return Parse.Promise.when(promises);

    });

    let deleteActivity = new Parse.Query('GalleryActivity').equalTo('gallery', req.object).find().then(results=> {
        // Collect one promise for each delete into an array.
        let promises = [];
        _.each(results, result => {
            promises.push(result.destroy());
            User.decrementGallery();
        });
        // Return a new promise that is resolved when all of the deletes are finished.
        return Parse.Promise.when(promises);

    });

    Parse.Promise.when([
        deleteActivity,
        deleteComments
    ]).then(res.success, res.error);


}

function afterSave(req) {
    const user = req.user;

    if (req.object.existed()) {
        return
    }

    let activity = {
        action  : 'addPhoto',
        fromUser: user,
        toUser  : req.object.user,
        gallery : req.object
    };
    console.log(activity);
    User.incrementGallery(user);
    GalleryActivity.create(activity);
}

function commentGallery(req, res) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 10;

    new Parse.Query(ParseObject)
        .equalTo('objectId', params.galleryId)
        .first()
        .then(gallery=> {

            new Parse.Query('GalleryComment')
                .equalTo('gallery', gallery)
                .limit(_limit)
                .skip((_page * _limit) - _limit)
                .find({useMasterKey: true})
                .then(data=> {
                    let _result = [];

                    if (!data.length) {
                        res.success(_result);
                    }

                    let cb = _.after(data.length, ()=> {
                        res.success(_result);
                    });

                    _.each(data, itemComment=> {

                        // User Data
                        let userGet = itemComment.get('user');
                        new Parse.Query('UserData').equalTo('user', userGet).first().then(user=> {

                            let obj = {
                                object   : itemComment,
                                id       : itemComment.id,
                                createdAt: itemComment.get('createdAt'),
                                text     : itemComment.get('text'),
                                user     : {
                                    obj     : itemComment.get('user'),
                                    username: user.get('username'),
                                    name    : user.get('name'),
                                    status  : user.get('status'),
                                    photo   : user.get('photo')
                                }
                            };
                            console.log('Obj', obj);

                            _result.push(obj);
                            cb();
                        }, err=>console.log);
                    });
                }, error=> res.error(error.message))
        })
    ;
}


function feed(req, res, next) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 24;

    let _query = new Parse.Query(ParseObject);

    if (params.filter) {
        _query.contains('words', params.filter);
    }

    if (params.hashtags) {
        _query.containsAll("hashtags", [params.hashtags]);
    }

    let following = [];

    if (params.username) {
        new Parse.Query(Parse.User)
            .equalTo('username', params.username)
            .first({useMasterKey: true})
            .then(user=> {
                _query.equalTo('user', user);
                runQuery();
            }, error=> {
                runQuery();
            });
    } else {
        new Parse.Query(UserFollow)
            .equalTo('from', req.user)
            .include('user')
            .find({useMasterKey: true})
            .then(users=> {
                following = _.map(users, userFollow=> {
                    return userFollow.get('to');
                });

                following.push(req.user);

                console.log(following);
                runQuery();


            }, res.error);
    }


    function runQuery() {
        _query
            .equalTo('isApproved', true)
            .descending('createdAt')
            .limit(_limit)
            .skip((_page * _limit) - _limit)
            .containedIn('user', following)
            .find()
            .then(data=> {
                let _result = [];

                if (!data.length) {
                    res.success(_result);
                }

                let cb = _.after(data.length, ()=> {
                    res.success(_result);
                });

                _.each(data, itemGallery=> {

                    // User Data
                    let userGet = itemGallery.get('user');
                    new Parse.Query('UserData').equalTo('user', userGet).first({useMasterKey: true}).then(user=> {

                        let obj = {
                            id           : itemGallery.id,
                            galleryObj   : itemGallery,
                            comments     : [],
                            createdAt    : itemGallery.get('createdAt'),
                            image        : itemGallery.get('image'),
                            imageThumb   : itemGallery.get('imageThumb'),
                            title        : itemGallery.get('title'),
                            commentsTotal: itemGallery.get('commentsTotal') || 0,
                            likesTotal   : itemGallery.get('likesTotal') || 0,
                            isApproved   : itemGallery.get('isApproved'),
                            user         : {
                                obj     : itemGallery.get('user'),
                                name    : user.get('name'),
                                username: user.get('username'),
                                status  : user.get('status'),
                                photo   : user.get('photo')
                            }
                        };
                        //console.log('Obj', obj);

                        // Is Liked
                        new Parse.Query('Gallery')
                            .equalTo('likes', req.user)
                            .equalTo('objectId', itemGallery.id)
                            .first({useMasterKey: true})
                            .then(liked=> {
                                obj.isLiked = liked ? true : false;

                                // Comments
                                new Parse.Query('GalleryComment')
                                    .equalTo('gallery', itemGallery)
                                    .limit(3)
                                    .find({useMasterKey: true})
                                    .then(comments=> {
                                        comments.map(function (comment) {
                                            obj.comments.push({
                                                id  : comment.id,
                                                obj : comment,
                                                user: {
                                                    obj     : itemGallery.get('user'),
                                                    name    : user.get('name'),
                                                    username: user.get('username'),
                                                    status  : user.get('status'),
                                                    photo   : user.get('photo')
                                                },
                                                text: comment.get('text'),
                                            })
                                        });
                                        //console.log('itemGallery', itemGallery, user, comments);
                                        // Comments
                                        _result.push(obj);
                                        cb();

                                    }, error=> res.error(error.message));
                            }, error=> res.error(error.message));
                    }, err=>console.log);
                });
            }, error=> res.error(error.message))
    }
}


function likeGallery(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    let objParse;
    let activity;
    let response = {action: null};

    new Parse.Query('Gallery').get(galleryId).then(gallery => {
        objParse = gallery;
        return new Parse.Query('Gallery')
            .equalTo('likes', user)
            .equalTo('objectId', galleryId)
            .find();
    }).then(result => {

        console.log('step1', result);
        let relation = objParse.relation('likes');

        console.log('step2', relation);
        console.log('step3', relation.length);

        if (result && result.length > 0) {
            objParse.increment('likesTotal', -1);
            relation.remove(user);
            response.action = 'unlike';
        } else {
            objParse.increment('likesTotal');
            relation.add(user);
            response.action = 'like';
        }

        activity = {
            fromUser: user,
            gallery : objParse,
            action  : response.action
        };

        console.log('step4', activity);

        return objParse.save(null, {useMasterKey: true});

    }).then(data => {
        GalleryActivity.create(activity);
        res.success(response);
    }, error=> res.error);
}

function isGalleryLiked(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    new Parse.Query('Gallery')
        .equalTo('likes', user)
        .equalTo('objectId', galleryId)
        .first({useMasterKey: true})
        .then(gallery=>res.success(gallery ? true : false), error=> res.error(error.message));
}


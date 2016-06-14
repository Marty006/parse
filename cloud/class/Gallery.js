'use strict';
const _               = require('lodash');
const Image           = require('./../helpers/image');
const User            = require('./../class/User');
const GalleryActivity = require('./../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('Gallery');

module.exports = {
    feed          : feed,
    isGalleryLiked: isGalleryLiked,
    likeGallery   : likeGallery,
    beforeSave    : beforeSave,
    afterSave     : afterSave
};

function feed(req, res, next) {
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 10;

    console.log('Start Feed', req.params);

    let _query = new Parse.Query(ParseObject);

    //if (req.params.user) {
    //    _query.equalTo('user', req.params.user)
    //}

    _query
        .equalTo('isApproved', true)
        .descending('createdAt')
        .include('User')
        .limit(_limit)
        .skip((_page * _limit) - _limit);

    let queryFind  = _query.find();
    let queryCount = _query.count();

    new Parse.Promise.when(queryFind, queryCount)
        .then((data, total)=> {
            let _result = {
                total: total,
                rows : data
            };


            return res.success(_result);
            
            if (!data.length) {
                res.error(true);
            }

            let cb = _.after(data.length, ()=> {
                console.log('Agora');
                res.success(_result);
            });

            _.each(data, item=> {

                var obj = {
                    id        : item.id,
                    createdAt : item.get('createdAt'),
                    likes     : item.get('qtdLike') || 0,
                    image     : item.get('image'),
                    user      : item.get('user'),
                    user2      : item.get('User'),
                    userName  : item.get('user').get('name'),
                    userAvatar: item.get('user').get('photo')
                };

                console.log(obj);
                //var _comments = item.relation('comments');

                _result.rows.push(obj);
                cb();
            });


        }, error=> res.error(error.message));


    //_query.then(resp=> {
    //
    //    console.log(resp);
    //    console.log('home', resp);
    //    var qtd = resp.length;
    //
    //    if (!qtd) {
    //        res.error(true);
    //    }
    //
    //    console.log('Feed', resp);
    //
    //    resp.map(item=> {
    //        let user = item.get('user');
    //        console.log('user', user);
    //        console.log('name', user.get('name'));
    //        //console.log(user.get('image'));
    //    })
    //
    //    return res.success(resp);
    //
    //    let cb = _.after(resp.length, function () {
    //        res.success(_result);
    //    });
    //
    //    _.each(resp, item=> {
    //        //grab relations
    //
    //        var obj = {
    //            id        : item.get('id'),
    //            created   : item.get('createdAt'),
    //            likes     : item.get('qtdLike') || 0,
    //            image     : item.get('image'),
    //            user_id   : item.attributes.user.id,
    //            userName  : item.attributes.user.attributes.name,
    //            userAvatar: User.avatar(item.attributes.user.attributes),
    //            userStatus: item.attributes.user.attributes.status
    //        };
    //
    //        var _likes    = item.relation('likes');
    //        var _comments = item.relation('comments');
    //
    //        _likes
    //            .query()
    //            .equalTo('gallery', item)
    //            .equalTo('user', User)
    //            .count()
    //            .then(function (liked) {
    //                item.liked = (liked > 0) ? liked = true : liked = false;
    //                _comments
    //                    .query()
    //                    .include('commentBy')
    //                    .ascending('createdAt')
    //                    .limit(_limitComment)
    //                    .find()
    //                    .then(function (comments) {
    //
    //                        var commentsData = [];
    //                        comments.map(function (item) {
    //                            var user = item.attributes.commentBy;
    //
    //                            var comment = {
    //                                id        : item.id,
    //                                text      : item.attributes.text,
    //                                user      : user,
    //                                created   : item.attributes.createdAt,
    //                                userAvatar: User.avatar(user.attributes),
    //                                userName  : user.attributes.name
    //                            };
    //                            commentsData.push(comment);
    //                        });
    //
    //                        var obj = {
    //                            id        : item.id,
    //                            item      : item.attributes,
    //                            created   : item.createdAt,
    //                            likes     : item.attributes.qtdLike || 0,
    //                            liked     : liked,
    //                            img       : item.attributes.img._url,
    //                            comments  : commentsData,
    //                            user_id   : item.attributes.user.id,
    //                            userName  : item.attributes.user.attributes.name,
    //                            userAvatar: User.avatar(item.attributes.user.attributes),
    //                            userStatus: item.attributes.user.attributes.status
    //                        };
    //
    //                        // console.table(obj);
    //                        _result.rows.push(obj);
    //                        cb();
    //                    });
    //            });
    //
    //    });
    //});
}


function beforeSave(req, res) {

    const Image = require('./../helpers/image');
    const post  = req.object;
    const user  = req.user;

    console.log('Gallery Add', post);
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
    hashtags        = _.map(hashtags, toLowerCase);

    post.set('words', words);
    post.set('hashtags', hashtags);

    // User by Post Image
    post.set('user', user);

    post.set('isApproved', true);

    // Resize Image
    var imageUrl = post.get('image').url();

    Image
        .resize(imageUrl, 640, 640)
        .then(function (base64) {
            return Image.saveImage(base64);
        })
        .then(function (savedFile) {
            post.set('image', savedFile);
            return Image.resize(imageUrl, 160, 160);
        })
        .then(function (base64) {
            return Image.saveImage(base64);
        })
        .then(function (savedFile) {
            post.set('imageThumb', savedFile);
            res.success();
        }, function (error) {
            res.error(error.message);
        });
}

function afterSave(req, res) {
    const user   = req.user;
    let activity = {
        action : 'add photo',
        user   : user,
        gallery: req.object
    };
    console.log(activity);
    GalleryActivity.create(activity);
}


function likeGallery(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    var objGallery;
    var response = {action: null};

    new Parse.Query('Gallery')
        .get(galleryId)
        .then(gallery => Parse.Query('Gallery').equalTo('likes', user).equalTo('objectId', gallery).find())
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


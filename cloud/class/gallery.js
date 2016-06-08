'use strict';
const Image = require('../../helpers/image');
const User  = require('../class/user');
const _     = require('lodash');

module.exports = {
    feed: feed,
    isGalleryLiked: isGalleryLiked,
    likeGallery: likeGallery,
    beforeSave: beforeSave
};


function feed(req, res, next) => {
    const User          = req.user;
    const _page         = req.params.page;
    const _limit        = req.params.limit;
    const _userId       = req.params.userId;
    const _limitComment = req.params.limitComment || 10;

    let _result = {
        total: 0,
        rows: []
    };

    if (!User) {
        return res.error('Not Authorized');
    }


    function _query() {
        if (_userId) {
            return new Parse
                .Query('Gallery')
                .descending('createdAt')
                .equalTo('user', User);
        } else {
            return new Parse
                .Query('Gallery')
                .descending('createdAt');
            //.notEqualTo('user', user)
            //.containedIn('ref', following)
            //.containsAll('ref', following)
        }
    };

    _query()
    _query()
        .include('user')
        .limit(_limit)
        .skip(_page * _limit)
        .find()
        .then(function (resp) {

            // console.log('home', resp);
            var qtd = resp.length;

            if (!qtd) {
                res.error(true);
            }

            let cb = _.after(resp.length, function () {
                res.success(_result);
            });

            _.each(resp, function (item) {
                //grab relations

                var _likes    = item.relation('likes');
                var _comments = item.relation('comments');

                _likes
                    .query()
                    .equalTo('gallery', item)
                    .equalTo('user', User)
                    .count()
                    .then(function (liked) {
                        (liked > 0) ? liked = true : liked = false;
                        _comments
                            .query()
                            .include('commentBy')
                            .ascending('createdAt')
                            .limit(_limitComment)
                            .find()
                            .then(function (comments) {

                                var commentsData = [];
                                comments.map(function (item) {
                                    var user = item.attributes.commentBy;

                                    var comment = {
                                        id: item.id,
                                        text: item.attributes.text,
                                        user: user,
                                        created: item.attributes.createdAt,
                                        userAvatar: User.avatar(user.attributes),
                                        userName: user.attributes.name
                                    };
                                    commentsData.push(comment);
                                });

                                var obj = {
                                    id: item.id,
                                    item: item.attributes,
                                    created: item.createdAt,
                                    likes: item.attributes.qtdLike || 0,
                                    liked: liked,
                                    img: item.attributes.img._url,
                                    comments: commentsData,
                                    user_id: item.attributes.user.id,
                                    userName: item.attributes.user.attributes.name,
                                    userAvatar: User.avatar(item.attributes.user.attributes),
                                    userStatus: item.attributes.user.attributes.status
                                };

                                // console.table(obj);
                                _result.rows.push(obj);
                                cb();
                            });
                    });

            });
        });
}

function isGalleryLiked(req, res, next) => {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    var query = new Parse.Query('Gallery');
    query.equalTo('likes', user);
    query.equalTo('objectId', galleryId);

    query.first({useMasterKey: true})
         .then(place=>res.success(place ? true : false), error=> res.error(error.message));
}

function likeGallery(req, res, next)=> {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    const query  = new Parse.Query('Gallery');
    var objGallery;
    var response = {action: null};

    query.get(galleryId)
         .then(place=> {
             objGallery     = place;
             var queryPlace = new Parse.Query('Gallery');
             queryPlace.equalTo('likes', user);
             queryPlace.equalTo('objectId', galleryId)
             return queryPlace.find();
         })
         .then(result=> {
             var relation = objGallery.relation('likes');

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

function beforeSave(req, res) => {

    const gallery     = req.object;
    const user        = req.user;
    const isMasterKey = req.master;

    if (!gallery.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        acl.setWriteAccess(user, true);
        gallery.setACL(acl);
    }

    if (isMasterKey) {
        return res.success();
    }

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!gallery.get('image')) {
        return res.error('Upload the first image');
    }

    if (gallery.dirty('title') && gallery.get('title')) {
        gallery.set('canonical', gallery.get('title').toLowerCase());
    }

    if (!gallery.dirty('image')) {
        return res.success();
    }

    var promises = [];

    if (gallery.dirty('image')) {
        var url = gallery.get('image').url();

        var promise = Image.resize(url, 640, 640).then(function (base64) {
            return Image.saveImage(base64);
        }).then(function (savedFile) {
            gallery.set('image', savedFile);
        });

        promises.push(promise);

        var promiseThumb = Image.resize(url, 160, 160).then(function (base64) {
            return Image.saveImage(base64);
        }).then(function (savedFile) {
            gallery.set('imageThumb', savedFile);
        });

        promises.push(promiseThumb);
    }
    Parse.Promise.when(promises).then(success=>res.success(success), error=> res.error(error.message));
}
'use strict';
const Image = require('../helpers/image');

function saveImage(base64) {
    return Parse.File('image.jpg', {base64: base64}).save();
}

Parse.Cloud.define('findUserByEmail', (req, res) => {
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', req.params.email);
    query.first({useMasterKey: true})
         .then(results => res.success(results || {}), error=> res.error(error.message));
});

Parse.Cloud.define('isPlaceLiked', (req, res) => {
    var user    = req.user;
    var placeId = req.params.placeId;

    if (!user) {
        return res.error('Not Authorized');
    }

    var query = new Parse.Query('Place');
    query.equalTo('likes', user);
    query.equalTo('objectId', placeId);

    query.first({useMasterKey: true})
         .then(place=>res.success(place ? true : false), error=> res.error(error.message));
});

Parse.Cloud.define('likeGallery', (req, res) => {

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

});

Parse.Cloud.define('getUsers', (req, res) => {

    var params = req.params;
    var user   = req.user;

    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Admin');
    query.equalTo('users', user);
    query.first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        var query = new Parse.Query(Parse.User);

        if (params.filter != '') {
            query.contains('email', params.filter);
        }

        query.descending('createdAt');
        query.limit(params.limit);
        query.skip((params.page * params.limit) - params.limit);

        var queryUsers = query.find({useMasterKey: true});
        var queryCount = query.count({useMasterKey: true});

        return Parse.Promise.when(queryUsers, queryCount);
    })
         .then((users, total) =>res.success({
             users: users,
             total: total
         }), error=> res.error(error.message));
});

Parse.Cloud.define('createUser', (req, res) => {

    var data = req.params;
    var user = req.user;

    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Admin');
    query.equalTo('users', user);
    query.first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        } else {

            var user = new Parse.User();
            user.set('name', data.name);
            user.set('username', data.email);
            user.set('email', data.email);
            user.set('password', data.password);
            user.set('photo', data.photo);
            user.set('roleName', data.roleName);

            user.signUp().then(function (objUser) {
                objUser.setACL(new Parse.ACL(objUser));
                objUser.save(null, {useMasterKey: true});
                res.success(objUser);
            }, function (error) {
                res.error(error);
            });
        }
    }, error=> res.error(error.message));
});

Parse.Cloud.define('updateUser', function (req, res) {

    var data = req.params;
    var user = req.user;

    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Admin');
    query.equalTo('users', user);
    query.first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        var query = new Parse.Query(Parse.User);
        query.equalTo('objectId', data.id);
        return query.first({useMasterKey: true});
    }).then(function (objUser) {

        objUser.set('name', data.name);
        objUser.set('username', data.email);
        objUser.set('email', data.email);
        objUser.set('photo', data.photo);

        if (!data.password) {
            objUser.set('password', data.password);
        }

        return objUser.save(null, {useMasterKey: true});
    }).then(success=>res.success(success), error=> res.error(error.message));
});

Parse.Cloud.define('destroyUser', function (req, res) {

    var params = req.params;
    var user   = req.user;

    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Admin');
    query.equalTo('users', user);
    query.first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        var query = new Parse.Query(Parse.User);
        query.equalTo('objectId', params.id);
        return query.first({useMasterKey: true});
    }).then(function (objUser) {

        if (!objUser) {
            return res.error('User not found');
        }

        return objUser.destroy({useMasterKey: true});
    }).then(success=>res.success(success), error=> res.error(error.message));
});

Parse.Cloud.define('saveFacebookPicture', (req, res) => {

    var user = req.user;

    if (!user) {
        return res.error('Not Authorized');
    }

    var authData = user.get('authData');
    if (!authData) {
        return res.success();
    }

    var profilePictureUrl = 'https://graph.facebook.com/' + authData.facebook.id + '/picture';

    return Parse.Cloud.httpRequest({
        url: profilePictureUrl,
        followRedirects: true,
        params: {type: 'large'}
    }).then(httpResponse=> {
        var buffer    = httpResponse.buffer;
        var base64    = buffer.toString('base64');
        var parseFile = new Parse.File('image.jpg', {base64: base64});
        return parseFile.save();
    }).then(savedFile=> {
        user.set({'photo': savedFile});
        return user.save(null, {sessionToken: user.getSessionToken()});
    }).then(success=>res.success(success), error=> res.error(error.message));
});

Parse.Cloud.beforeSave('Category', (req, res) => {

    var category = req.object;
    var user     = req.user;

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!category.get('image')) {
        return res.error('The field Image is required.');
    }

    if (!category.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        category.setACL(acl);
    }

    if (category.dirty('title') && category.get('title')) {
        category.set('canonical', category.get('title').toLowerCase());
    }

    if (!category.dirty('image')) {
        return res.success();
    }

    var imageUrl = category.get('image').url();

    Image.resize(imageUrl, 640, 640).then(function (base64) {
        return saveImage(base64);
    }).then(function (savedFile) {
        category.set('image', savedFile);
        return Image.resize(imageUrl, 160, 160);
    }).then(function (base64) {
        return saveImage(base64);
    }).then(savedFile=> {
        category.set('imageThumb', savedFile);
        res.success();
    }, error=> res.error(error.message));

});

Parse.Cloud.beforeSave('Gallery', (req, res) => {

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
            return saveImage(base64);
        }).then(function (savedFile) {
            gallery.set('image', savedFile);
        });

        promises.push(promise);

        var promiseThumb = Image.resize(url, 160, 160).then(function (base64) {
            return saveImage(base64);
        }).then(function (savedFile) {
            gallery.set('imageThumb', savedFile);
        });

        promises.push(promiseThumb);
    }

    Parse.Promise.when(promises).then(success=>res.success(success), error=> res.error(error.message));
});

Parse.Cloud.beforeSave('Review', (req, res) => {

    var review   = req.object;
    var user     = req.user;
    var userData = review.get('userData');
    var place    = review.get('place');

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!review.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        acl.setWriteAccess(user, true);
        review.setACL(acl);
        review.set('isInappropriate', false);
    }

    if (review.existed() && review.dirty('isInappropriate')) {
        return res.success();
    }

    var query = new Parse.Query('Review');
    query.equalTo('userData', userData);
    query.equalTo('place', place);

    query.find({
        success: res1 => {
            if (res1.length > 0) {
                res.error('You already write a review for this place');
            } else {

                if (review.get('rating') < 1) {
                    res.error('You cannot give less than one star');
                } else if (review.get('rating') > 5) {
                    res.error('You cannot give more than five stars');
                } else {
                    res.success();
                }
            }
        },
        error: (obj, error) => {
            res.error(error);
        }
    });
});

Parse.Cloud.afterSave('Review', (req) => {

    var review  = req.object;
    var rating  = review.get('rating');
    var placeId = review.get('place').id;

    var query = new Parse.Query('Place');

    query.get(placeId).then(place=> {

        var currentTotalRating = place.get('ratingTotal') || 0;

        place.increment('ratingCount');
        place.set('ratingTotal', currentTotalRating + rating);
        place.save(null, {useMasterKey: true});

    }, error=>console.log('Got an error ' + error.code + ' : ' + error.message));
});

Parse.Cloud.beforeSave(Parse.User, (req, res) => {

    var user = req.object;

    if (user.existed() && user.dirty('roleName')) {
        return res.error('Role cannot be changed');
    }

    if (!user.get('photo') || !user.dirty('photo')) {
        return res.success();
    }

    var imageUrl = user.get('photo').url();

    Image.resize(imageUrl, 160, 160)
         .then(base64=> saveImage(base64))
         .then(savedFile=> {
             user.set('photo', savedFile);
             res.success();
         }, error=>res.error(error));
});

Parse.Cloud.afterSave(Parse.User, req=> {

    var user           = req.object;
    var userRequesting = req.user;

    var queryUserData = new Parse.Query('UserData');
    queryUserData.equalTo('user', user);
    queryUserData.first().then(function (userData) {

        if (userData) {
            userData.set('name', user.get('name'));
            userData.set('photo', user.get('photo'));
        } else {

            var aclUserData = new Parse.ACL();
            aclUserData.setPublicReadAccess(true);
            aclUserData.setWriteAccess(user, true);

            var userData = new Parse.Object('UserData', {
                user: user,
                ACL: aclUserData,
                name: user.get('name'),
                photo: user.get('photo'),
            });
        }
        userData.save(null, {useMasterKey: true});
    });

    if (!user.existed()) {

        var query = new Parse.Query(Parse.Role);
        query.equalTo('name', 'Admin');
        query.equalTo('users', userRequesting);
        query.first().then(function (isAdmin) {

            if (!isAdmin && user.get('roleName') === 'Admin') {
                return Parse.Promise.error({
                    code: 1,
                    message: 'Not Authorized'
                });
            }

            var roleName = user.get('roleName') || 'User';

            var innerQuery = new Parse.Query(Parse.Role);
            innerQuery.equalTo('name', roleName);
            return innerQuery.first();
        }).then(function (role) {

            if (!role) {
                return Parse.Promise.error('Role not found');
            }

            role.getUsers().add(user);
            return role.save();
        })
             .then(()=>console.log(success), error=>console.error('Got an error ' + error.code + ' : ' + error.message));
    }
});

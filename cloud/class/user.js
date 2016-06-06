'use strict';
const Image    = require('../../helpers/image');
module.exports = {
    beforeSave: (req, res)=> {
        var user = req.object;

        if (user.existed() && user.dirty('roleName')) {
            return res.error('Role cannot be changed');
        }

        if (!user.get('photo') || !user.dirty('photo')) {
            return res.success();
        }

        var imageUrl = user.get('photo').url();

        Image.resize(imageUrl, 160, 160)
             .then(base64=> Image.saveImage(base64))
             .then(savedFile=> {
                 user.set('photo', savedFile);
                 res.success();
             }, error=>res.error(error));

    },
    afterSave: (req, res)=> {
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

                let userData = new Parse.Object('UserData', {
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

    },
    createUser: (req, res, next) => {
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

    },
    findUserByEmail: (req, res, next) => {
        const query = new Parse.Query(Parse.User);
        query.equalTo('email', req.params.email);
        query.first({useMasterKey: true}).then(results => res.success(results || {}), error=> res.error(error.message));
    },
    getUsers: (req, res, next)=> {
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

    },
    updateUser: (req, res, next) => {
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
    },
    destroyUser: (req, res, next)=> {
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
    },
    saveFacebookPicture: (req, res, next) => {
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
    }
};


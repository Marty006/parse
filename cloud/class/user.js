'use strict';
const Image           = require('../helpers/image');
const GalleryActivity = require('../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('User');

module.exports = {
    beforeSave         : beforeSave,
    afterSave          : afterSave,
    profile            : profile,
    avatar             : avatar,
    get                : get,
    createUser         : createUser,
    findUserByEmail    : findUserByEmail,
    getUsers           : getUsers,
    updateUser         : updateUser,
    destroyUser        : destroyUser,
    saveFacebookPicture: saveFacebookPicture,
    validateUsername   : validateUsername,
    validateEmail      : validateEmail
};

function profile() {

}

function get(userId) {
    return new Parse.Query(ParseObject).get(userId);
}

function avatar(obj) {
    if (obj.facebookimg) {
        return obj.facebookimg;
    } else {
        return obj.img ? obj.img._url : 'img/user.png';
    }
}
function beforeSave(req, res) {
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

}

function afterSave(req, res) {
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
                user : user,
                ACL  : aclUserData,
                name : user.get('name'),
                photo: user.get('photo'),
            });
        }
        userData.save(null, {useMasterKey: true});
    });

    GalleryActivity.create({
        action: 'user enter',
        user  : user
    });

    if (!user.existed()) {

        var query = new Parse.Query(Parse.Role);
        query.equalTo('name', 'Admin');
        query.equalTo('users', userRequesting);
        query.first().then(function (isAdmin) {

            if (!isAdmin && user.get('roleName') === 'Admin') {
                return Parse.Promise.error({
                    code   : 1,
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
        }).then(()=>console.log(success), error=>console.error('Got an error ' + error.code + ' : ' + error.message));
    }
}

function createUser(req, res, next) {
    var data = req.params;
    var user = req.user;

    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', 'Admin');
    query.equalTo('users', user);
    query.first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        } else {

            new Parse.User()
                .set('name', data.name)
                .set('username', data.email)
                .set('email', data.email)
                .set('password', data.password)
                .set('photo', data.photo)
                .set('roleName', data.roleName)
                .signUp()
                .then(objUser=> {
                    objUser.setACL(new Parse.ACL(objUser));
                    objUser.save(null, {useMasterKey: true});
                    res.success(objUser);
                }, error=>res.error(error));
        }
    }, error=> res.error(error.message));
}

function findUserByEmail(req, res, next) {
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', req.params.email);
    query.first({useMasterKey: true}).then(results => res.success(results || {}), error=> res.error(error.message));
}

function getUsers(req, res, next) {
    var params = req.params;
    var user   = req.user;
    var query  = new Parse.Query(Parse.Role);
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
}

function updateUser(req, res, next) {
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
}

function destroyUser(req, res, next) {
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
}

function saveFacebookPicture(req, res, next) {
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
        url            : profilePictureUrl,
        followRedirects: true,
        params         : {type: 'large'}
    }).then(httpResponse=> {
        let buffer = httpResponse.buffer;
        let base64 = buffer.toString('base64');
        return new Parse.File('image.jpg', {base64: base64}).save();
    }).then(savedFile=> {
        user.set({'photo': savedFile});
        return user.save(null, {sessionToken: user.getSessionToken()});
    }).then(success=>res.success(success), error=> res.error(error.message));
}

function validateUsername(req, res) {
    new ParseObject()
        .equalTo('username', req.params.input)
        .count({
            success: res.error,
            error  : res.success
        })
}

function validateEmail(req, res) {
    console.log(req);
    console.log(req.params.input.trim());
    new Parse.Query(Parse.User)
        .contains('email', req.params.input.trim())
        //.count()
        .find({
            success: function (data) {
                console.log(data);
                if (data > 0) {
                    res.success(false);
                } else {
                    res.success(true);
                }
            },
            error  : function () {
                res.success(true)
            }
        })
}
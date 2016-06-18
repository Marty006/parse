'use strict';
const Image           = require('../helpers/image');
const GalleryActivity = require('../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('User');
module.exports        = {
    beforeSave         : beforeSave,
    afterSave          : afterSave,
    afterDelete        : afterDelete,
    profile            : profile,
    avatar             : avatar,
    get                : get,
    createUser         : createUser,
    findUserByEmail    : findUserByEmail,
    getUsers           : getUsers,
    updateUser         : updateUser,
    destroyUser        : destroyUser,
    saveFacebookPicture: saveFacebookPicture,
    follow             : follow,
    validateUsername   : validateUsername,
    validateEmail      : validateEmail,
    incrementGallery   : incrementGallery,
    incrementFollowers : incrementFollowers,
    incrementFollowing : incrementFollowing,
    incrementComment   : incrementComment,
};

function follow(req, res) {
    const object = req.params;
    const user   = req.user;
    if (!user) {
        return res.error('Not Authorized');
    }

    if (!object.toUser) {
        return res.error('Not Authorized');
    }

    new Parse.Query(Parse.Object.extend('UserFollow'))
        .set('toUser', object.toUser)
        .set('fromUser', user)
        .set('date', Date())
        .save({useMasterKey: true})
        .then(res.success, error=>res.error);
}

function profile(req, res) {
    var params = req.params;
    var user   = req.user;

    new Promise.Query('UserData').equalTo('users', user).first().then(function (user) {

        //if (!adminRole) {
        //    return res.error('Not Authorized');
        //}

        let query = new Parse.Query(Parse.User);

        if (params.filter != '') {
            query.contains('email', params.filter);
        }

        query.descending('createdAt')
             .limit(params.limit)
             .skip((params.page * params.limit) - params.limit);

        return Parse.Promise.when(query.find({useMasterKey: true}), query.count({useMasterKey: true}));
    }).then((users, total) =>res.success({
        users: users,
        total: total
    }), error=> res.error(error.message));

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


function afterDelete(req, res) {

}
function afterSave(req, res) {
    var user           = req.object;
    var userRequesting = req.user;

    new Parse.Query('UserData').equalTo('user', user).first().then(userData => {

        if (userData) {
            userData.set('name', user.get('name'));
            userData.set('status', user.get('status'));
            userData.set('username', user.get('username'));
            userData.set('photo', user.get('photo'));
            userData.set('galleriesTotal', 0);
            userData.set('followersTotal', 0);
            userData.set('followingsTotal', 0);
        } else {

            const roleACL = new Parse.ACL();
            roleACL.setPublicReadAccess(true);
            roleACL.setWriteAccess(user, true);

            userData = new Parse.Object('UserData', {
                user           : user,
                ACL            : roleACL,
                name           : user.get('name'),
                username       : user.get('username'),
                status         : user.get('status'),
                photo          : user.get('photo'),
                galleriesTotal : 0,
                followersTotal : 0,
                followingsTotal: 0,
            });
        }
        userData.save(null, {useMasterKey: true});
    });

    if (!user.existed()) {

        new Parse.Query(Parse.Role)
            .equalTo('name', 'Admin')
            .equalTo('users', userRequesting)
            .first().then(function (isAdmin) {

            if (!isAdmin && user.get('roleName') === 'Admin') {
                return Parse.Promise.error({
                    code   : 1,
                    message: 'Not Authorized'
                });
            }

            let roleName   = user.get('roleName') || 'User';
            let innerQuery = new Parse.Query(Parse.Role);
            innerQuery.equalTo('name', roleName);
            return innerQuery.first();
        }).then(role=> {
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
                .set('gender', data.password)
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
    query.first().then(adminRole => {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        const query = new Parse.Query(Parse.User);

        if (params.filter != '') {
            query.contains('email', params.filter);
        }

        query.descending('createdAt');
        query.limit(params.limit);
        query.skip((params.page * params.limit) - params.limit);

        return Parse.Promise.when(query.find({useMasterKey: true}), query.count({useMasterKey: true}));
    })
         .then((users, total) =>res.success({
             users: users,
             total: total
         }), error=> res.error(error.message));
}

function updateUser(req, res, next) {
    var data = req.params;
    var user = req.user;

    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        return new Parse.Query(Parse.User)
            .equalTo('objectId', data.id)
            .first({useMasterKey: true});
    }).then(objUser => {

        objUser.set('name', data.name);
        objUser.set('username', data.email);
        objUser.set('status', data.status);
        objUser.set('gender', data.gender);
        objUser.set('email', data.email);

        if (data.photo) {
            objUser.set('photo', data.photo);
        }

        if (data.password) {
            objUser.set('password', data.password);
        }

        return objUser.save(null, {useMasterKey: true});
    }).then(success=>res.success(success), error=> res.error(error.message));
}

function destroyUser(req, res, next) {
    var params = req.params;
    var user   = req.user;

    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first().then(adminRole=> {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        return new Parse.Query(Parse.User)
            .equalTo('objectId', params.id)
            .first({useMasterKey: true});
    }).then(objUser=> {

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


function incrementGallery(user) {
    new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        console.log('incrementGallery', user);
        user.increment('galleriesTotal');
        user.save(null, {useMasterKey: true})
            .then(success=>console.log('galleriesTotal', success), error=>console.log('Got an error ' + error.code + ' : ' + error.message));
    });
}

//seguidoes
function incrementFollowers(user) {
    new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        user.increment('followersTotal');
        user.save(null, {useMasterKey: true})
            .then(success=>console.log('followersTotal', success), error=>console.log('Got an error ' + error.code + ' : ' + error.message));
    });
}
//seguindo
function incrementFollowing(user) {
    new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        user.increment('followingsTotal');
        user.save(null, {useMasterKey: true})
            .then(success=>console.log('followingTotal', success), error=>console.log('Got an error ' + error.code + ' : ' + error.message));
    });
}

function incrementComment(user) {
    new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        user.increment('commentsTotal');
        user.save(null, {useMasterKey: true})
            .then(success=>console.log('comemntTotal', success), error=>console.log('Got an error ' + error.code + ' : ' + error.message));
    });
}
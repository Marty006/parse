'use strict';
const Image           = require('../helpers/image');
const GalleryActivity = require('../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('User');
const UserFollow      = Parse.Object.extend('UserFollow');
const UserData        = Parse.Object.extend('UserData');
const Gallery         = Parse.Object.extend('Gallery');
const _               = require('lodash');

module.exports = {
    beforeSave         : beforeSave,
    afterSave          : afterSave,
    afterDelete        : afterDelete,
    profile            : profile,
    avatar             : avatar,
    get                : get,
    createUser         : createUser,
    findUserByEmail    : findUserByEmail,
    findUserByUsername : findUserByUsername,
    getUsers           : getUsers,
    listUsers          : listUsers,
    updateUser         : updateUser,
    destroyUser        : destroyUser,
    saveFacebookPicture: saveFacebookPicture,
    follow             : follow,
    isFollow           : isFollow,
    getLikers          : getLikers,
    getFollowers       : getFollowers,
    getFollowing       : getFollowing,
    validateUsername   : validateUsername,
    validateEmail      : validateEmail,
    incrementGallery   : incrementGallery,
    incrementFollowers : incrementFollowers,
    incrementFollowing : incrementFollowing,
    incrementComment   : incrementComment,
};


function getLikers(req, res) {
    const params = req.params;

    let objParse;

    console.log('getLikers', params);

    new Parse.Query('Gallery')
        .get(params.galleryId)
        .then(gallery => {

            gallery
                .relation('likes')
                .query()
                .find({useMasterKey: true})
                .then(data=> {

                    let _result = [];

                    if (!data.length) {
                        res.success(_result);
                    }

                    let cb = _.after(data.length, ()=> {
                        res.success(_result);
                    });

                    _.each(data, user=> {

                        // User Data
                        new Parse.Query('UserData')
                            .equalTo('user', user)
                            .first({useMasterKey: true})
                            .then(userData=> {

                                new Parse.Query('Gallery')
                                    .equalTo('user', user)
                                    .limit(3)
                                    .descending('createdAt')
                                    .find()
                                    .then(galleries=> {

                                        let profile = {
                                            name           : userData.attributes.name,
                                            username       : userData.attributes.username,
                                            followersTotal : userData.attributes.followersTotal,
                                            followingsTotal: userData.attributes.followingsTotal,
                                            galleiresTotal : userData.attributes.galleriesTotal,
                                            status         : userData.attributes.status,
                                            photo          : userData.attributes.photo,
                                            userObj        : user.attributes.to,
                                            userDataObj    : userData,
                                            isFollow       : isFollow ? true : false,
                                            galleries      : galleries
                                        }
                                        _result.push(profile);
                                        cb();
                                    });

                            }, res.error);
                    });
                    res.success(users);
                });

        }, error=> res.error);
}
function getFollowers(req, res) {
    const params = req.params;


    if (params.username) {
        new Parse.Query(ParseObject)
            .equalTo('username', params.username)
            .first({useMasterKey: true})
            .then(user=> {
                new Parse.Query(UserFollow)
                    .equalTo('to', user)
                    .include('user')
                    .find({useMasterKey: true})
                    .then(data=> {

                        let _result = [];

                        if (!data.length) {
                            res.success(_result);
                        }

                        let cb = _.after(data.length, ()=> {
                            res.success(_result);
                        });

                        _.each(data, user=> {

                            // User Data
                            new Parse.Query('UserData')
                                .equalTo('user', user.attributes.from)
                                .first({useMasterKey: true})
                                .then(userData=> {

                                    new Parse.Query('Gallery')
                                        .equalTo('user', user.attributes.from)
                                        .limit(3)
                                        .descending('createdAt')
                                        .find()
                                        .then(galleries=> {

                                            let profile = {
                                                name           : userData.attributes.name,
                                                username       : userData.attributes.username,
                                                followersTotal : userData.attributes.followersTotal,
                                                followingsTotal: userData.attributes.followingsTotal,
                                                galleiresTotal : userData.attributes.galleriesTotal,
                                                status         : userData.attributes.status,
                                                photo          : userData.attributes.photo,
                                                userObj        : user.attributes.to,
                                                userDataObj    : userData,
                                                isFollow       : isFollow ? true : false,
                                                galleries      : galleries
                                            }
                                            console.log('profile', profile);
                                            _result.push(profile);
                                            cb();
                                        });

                                }, res.error);
                        });

                    }, res.error);

            })
    } else {
        new Parse.Query(UserFollow)
            .equalTo('to', req.user)
            .include('user')
            .find({useMasterKey: true})
            .then(data=> {

                let _result = [];

                if (!data.length) {
                    res.success(_result);
                }

                let cb = _.after(data.length, ()=> {
                    res.success(_result);
                });

                _.each(data, user=> {

                    // User Data
                    new Parse.Query('UserData')
                        .equalTo('user', user.attributes.to)
                        .first({useMasterKey: true})
                        .then(userData=> {

                            new Parse.Query('Gallery')
                                .equalTo('user', user.attributes.to)
                                .limit(3)
                                .descending('createdAt')
                                .find()
                                .then(galleries=> {

                                    let profile = {
                                        name           : userData.attributes.name,
                                        username       : userData.attributes.username,
                                        followersTotal : userData.attributes.followersTotal,
                                        followingsTotal: userData.attributes.followingsTotal,
                                        galleiresTotal : userData.attributes.galleriesTotal,
                                        status         : userData.attributes.status,
                                        photo          : userData.attributes.photo,
                                        userObj        : user.attributes.to,
                                        userDataObj    : userData,
                                        isFollow       : isFollow ? true : false,
                                        galleries      : galleries
                                    }
                                    console.log('profile', profile);
                                    _result.push(profile);
                                    cb();
                                });

                        }, res.error);
                });

            }, res.error);

    }
}


function getFollowing(req, res) {
    const params = req.params;

    if (params.username) {
        new Parse.Query(ParseObject)
            .equalTo('username', params.username)
            .first({useMasterKey: true})
            .then(user=> {
                new Parse.Query(UserFollow)
                    .equalTo('from', user)
                    .include('user')
                    .find({useMasterKey: true})
                    .then(data=> {

                        let _result = [];

                        if (!data.length) {
                            res.success(_result);
                        }

                        let cb = _.after(data.length, ()=> {
                            res.success(_result);
                        });

                        _.each(data, user=> {

                            // User Data
                            new Parse.Query('UserData')
                                .equalTo('user', user.attributes.to)
                                .first({useMasterKey: true})
                                .then(userData=> {

                                    new Parse.Query('Gallery')
                                        .equalTo('user', user.attributes.to)
                                        .limit(3)
                                        .descending('createdAt')
                                        .find()
                                        .then(galleries=> {

                                            let profile = {
                                                name           : userData.attributes.name,
                                                username       : userData.attributes.username,
                                                followersTotal : userData.attributes.followersTotal,
                                                followingsTotal: userData.attributes.followingsTotal,
                                                galleiresTotal : userData.attributes.galleriesTotal,
                                                status         : userData.attributes.status,
                                                photo          : userData.attributes.photo,
                                                userObj        : user.attributes.to,
                                                userDataObj    : userData,
                                                isFollow       : isFollow ? true : false,
                                                galleries      : galleries
                                            }
                                            console.log('profile', profile);
                                            _result.push(profile);
                                            cb();
                                        });

                                }, res.error);
                        });

                    }, res.error);

            })
    } else {
        new Parse.Query(UserFollow)
            .equalTo('from', req.user)
            .include('user')
            .find({useMasterKey: true})
            .then(data=> {

                let _result = [];

                if (!data.length) {
                    res.success(_result);
                }

                let cb = _.after(data.length, ()=> {
                    res.success(_result);
                });

                _.each(data, user=> {

                    // User Data
                    new Parse.Query('UserData').equalTo('user', user.attributes.to).first({useMasterKey: true})
                                               .then(userData=> {

                                                   new Parse.Query('Gallery')
                                                       .equalTo('user', user.attributes.to)
                                                       .limit(3)
                                                       .descending('createdAt')
                                                       .find()
                                                       .then(galleries=> {

                                                           let profile = {
                                                               name           : userData.attributes.name,
                                                               username       : userData.attributes.username,
                                                               followersTotal : userData.attributes.followersTotal,
                                                               followingsTotal: userData.attributes.followingsTotal,
                                                               galleiresTotal : userData.attributes.galleriesTotal,
                                                               status         : userData.attributes.status,
                                                               photo          : userData.attributes.photo,
                                                               userObj        : user.attributes.to,
                                                               userDataObj    : userData,
                                                               isFollow       : isFollow ? true : false,
                                                               galleries      : galleries
                                                           }
                                                           console.log('profile', profile);
                                                           _result.push(profile);
                                                           cb();
                                                       });

                                               }, res.error);
                });

            }, res.error);

    }
}

function follow(req, res) {
    const params = req.params;
    if (!req.user) {
        return res.error('Not Authorized');
    }

    if (!params.userId) {
        return res.error('Not Authorized');
    }

    new Parse.Query(Parse.User)
        .equalTo('objectId', params.userId)
        .first({useMasterKey: true})
        .then(toUser=> {

            new Parse.Query(UserFollow)
                .equalTo('from', req.user)
                .equalTo('to', toUser)
                .first({useMasterKey: true})
                .then(isFollow=> {


                    if (isFollow) {
                        // unfollow
                        Parse.Promise.when([
                            isFollow.destroy(),
                            decrementFollowers(toUser),
                            decrementFollowing(req.user),
                        ]).then(data=> {
                            res.success('unfollow');
                        });
                    } else {

                        // follow
                        let activity = {
                            action  : 'followUser',
                            fromUser: req.user,
                            toUser  : toUser,
                        };
                        new UserFollow()
                            .set('from', req.user)
                            .set('to', toUser)
                            .set('date', Date())
                            .save(null, {useMasterKey: true})
                            .then(data=> {
                                Parse.Promise.when([
                                    incrementFollowing(req.user),
                                    incrementFollowers(toUser),
                                    GalleryActivity.create(activity)
                                ]).then(data=> {
                                    console.log('data2', data);
                                    res.success('follow');
                                });
                            }, res.error);

                    }

                }, res.error);

        }, res.error)


}

function isFollow(req, res) {
    const user   = req.user;
    const params = req.params;
    if (!user) {
        return res.error('Not Authorized');
    }

    if (!params.toUser) {
        return res.error('Not Authorized');
    }
    new Parse.Query(UserFollow)
        .equalTo('from', user)
        .equalto('to', params.to)
        .count(data=> {
            if (data > 0) {
                res.success('following')
            } else {
                res.error('not following');
            }
        }, error=> {
            res.error('not following');
        });
}

function profile(req, res) {
    var params = req.params;

    if (!req.user) {
        return res.error('Not Authorized');
    }

    console.log('profile', params);
    let toUser;
    let userData;

    new Parse.Query(Parse.User)
        .equalTo('username', req.params.username)
        .first({useMasterKey: true})
        .then(user => {
            toUser = user;
            return new Parse.Query(UserData)
                .equalTo('user', user)
                .first()
        })
        .then(data=> {
            userData = data;
            new Parse.Query(UserFollow)
                .equalTo('from', req.user)
                .equalTo('to', toUser)
                .count()
                .then(isFollow=> {
                    let profile = {
                        name           : userData.attributes.name,
                        username       : userData.attributes.username,
                        followersTotal : userData.attributes.followersTotal,
                        followingsTotal: userData.attributes.followingsTotal,
                        galleiresTotal : userData.attributes.galleriesTotal,
                        status         : userData.attributes.status,
                        photo          : userData.attributes.photo,
                        userObj        : toUser,
                        userDataObj    : userData,
                        isFollow       : isFollow ? true : false
                    }
                    res.success(profile);
                }, res.error);
        }, res.error)
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

    console.log('user.existed', user.existed());

    new Parse.Query('UserData').equalTo('user', user).first({useMasterKey: true}).then(userData => {

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

        var query = new Parse.Query(Parse.Role);
        query.equalTo('name', 'Admin');
        query.equalTo('users', userRequesting);
        query.first().then(function (isAdmin) {

            if (!isAdmin && user.get('roleName') === 'Admin') {
                return Parse.Promise.error(new Parse.Error(1, 'Not Authorized'));
            }

            var roleName = user.get('roleName') || 'User';

            var innerQuery = new Parse.Query(Parse.Role);
            innerQuery.equalTo('name', roleName);
            return innerQuery.first();
        }).then(function (role) {

            if (!role) {
                return Parse.Promise.error(new Parse.Error(1, 'Role not found'));
            }

            role.getUsers().add(user);
            return role.save();
        }).then(function () {
            console.log(success);
        }, function (error) {
            console.error('Got an error ' + error.code + ' : ' + error.message);
        })
    }
}

function createUser(req, res, next) {
    var data = req.params;
    var user = req.user;

    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        } else {

            new Parse.User()
                .set('name', data.name)
                .set('username', data.username)
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

function findUserByUsername(req, res, next) {
    new Parse.Query(Parse.User)
        .equalTo('username', req.params.username)
        .first({useMasterKey: true})
        .then(user => {
            new Parse.Query(UserData)
                .equalTo('user', user)
                .first()
                .then(userdata=> {
                    if (userdata) {
                        res.success(userdata);
                    } else {
                        res.error(false);
                    }
                }, error=>res.error);
        }, error=> res.error(error.message));
}

function findUserByEmail(req, res, next) {
    new Parse.Query(Parse.User)
        .equalTo('email', req.params.email)
        .first({useMasterKey: true})
        .then(results => res.success(results || {}), error=> res.error(error.message));
}

function getUsers(req, res, next) {
    var params = req.params;
    var user   = req.user;
    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first()
        .then(adminRole => {

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

function listUsers(req, res, next) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 24;

    new Parse.Query(Parse.User)
        .descending('createdAt')
        .notContainedIn('objectId', [req.user.id])
        .limit(_limit)
        .skip((_page * _limit) - _limit)
        .find({useMasterKey: true})
        .then(data=> {

            console.log('users', data);

            let _result = [];

            if (!data.length) {
                res.success(_result);
            }

            let cb = _.after(data.length, ()=> {
                res.success(_result);
            });

            _.each(data, user=> {

                // User Data
                new Parse.Query('UserData').equalTo('user', user).first({useMasterKey: true}).then(userData=> {

                    // Follow
                    new Parse.Query(UserFollow)
                        .equalTo('from', req.user)
                        .equalTo('to', user)
                        .count()
                        .then(isFollow=> {

                            new Parse.Query('Gallery')
                                .equalTo('user', user)
                                .limit(3)
                                .descending('createdAt')
                                .find()
                                .then(galleries=> {

                                    let profile = {
                                        name           : userData.attributes.name,
                                        username       : userData.attributes.username,
                                        followersTotal : userData.attributes.followersTotal,
                                        followingsTotal: userData.attributes.followingsTotal,
                                        galleiresTotal : userData.attributes.galleriesTotal,
                                        status         : userData.attributes.status,
                                        photo          : userData.attributes.photo,
                                        userObj        : user,
                                        userDataObj    : userData,
                                        isFollow       : isFollow ? true : false,
                                        galleries      : galleries
                                    }
                                    console.log('profile', profile);
                                    _result.push(profile);
                                    cb();
                                })

                        }, res.error);

                }, res.error);
            });

        });

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

    if (user.attributes.photo.length) {
        return res.success('Photo user')
    }

    let facebook = user.attributes.facebook;


    if (!facebook) {
        return res.error('Not logged with facebook');
    }

    let profilePictureUrl = 'https://graph.facebook.com/' + facebook + '/picture';

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
    new Parse.Query(Parse.User)
        .equalTo('username', req.params.username)
        .first({useMasterKey: true})
        .then(count=> {
            console.log('validateUsername', count);
            if (count) {
                res.error(false);
            } else {
                res.success(true);
            }
        }, res.error)
}

function validateEmail(req, res) {
    new Parse.Query(Parse.User)
        .equalTo('email', req.params.email)
        .first({useMasterKey: true})
        .then(count=> {
            console.log('validateEmail', count);
            if (count) {
                res.error(false);
            } else {
                res.success(true);
            }
        }, res.error)
}


function incrementGallery(user) {
    return new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        return user.increment('galleriesTotal').save(null, {useMasterKey: true})
    });
}

//seguidoes
function incrementFollowers(user) {
    return new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        return user.increment('followersTotal').save(null, {useMasterKey: true});
    });
}
//seguindo
function incrementFollowing(user) {
    return new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        return user.increment('followingsTotal').save(null, {useMasterKey: true})
    });
}

//seguidoes
function decrementFollowers(user) {
    return new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        return user.increment('followersTotal', -1).save(null, {useMasterKey: true});
    });
}
//seguindo
function decrementFollowing(user) {
    return new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        return user.increment('followingsTotal', -1)
        user.save(null, {useMasterKey: true})
    });
}

function incrementComment(user) {
    return new Parse.Query('UserData').equalTo('user', user).first().then(user => {
        return user.increment('commentsTotal').save(null, {useMasterKey: true})
    });
}
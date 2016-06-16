'use strict';
const _           = require('lodash');
const User        = require('./../class/User');
const ParseObject = Parse.Object.extend('GalleryActivity');

module.exports = {
    beforeSave: beforeSave,
    afterSave : afterSave,
    create    : create,
    feed      : feed,
};


function feed(req, res, next) {
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 10;

    console.log('Start Feed', req.params);

    let _query = new Parse.Query(ParseObject);

    _query
        .descending('createdAt')
        .include('gallery')
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

            let cb = _.after(data.length, ()=> res.success(_result));

            _.each(data, item=> {

                let userGet = item.get('fromUser');
                new Parse.Query('UserData').equalTo('user', userGet).first().then(user=> {

                    let obj = {
                        obj      : item,
                        createdAt: item.get('createdAt'),
                        gallery  : item.get('gallery'),
                        action   : item.get('action')
                    };
                    if (user) {
                        obj.user = {
                            userObj: user,
                            id     : user.id,
                            name   : user.get('name') || user.get('username') || user.get('email'),
                            status : user.get('status'),
                            photo  : user.get('photo')
                        }
                    }
                    console.log('Obj', obj);

                    _result.rows.push(obj);
                    cb();
                }, err=>console.log);

            });


        }, error=> res.error(error.message));
}

function beforeSave(req, res) {
    const currentUser = req.user;
    const objectUser  = req.object.get('fromUser');
    const gallery     = req.object.get('gallery');

    if (gallery) {
        req.object.set('toUser', gallery.user);
    }

    if (!currentUser || !objectUser) {
        response.error('An Activity should have a valid fromUser.');
    } else if (currentUser.id === objectUser.id) {
        res.success();
    } else {
        res.error('Cannot set fromUser on Activity to a user other than the current user.');
    }
}

function afterSave(req, res) {
    if (req.object.existed()) {
        return
    }

    // Send Notification toUser
    const toUser = req.object.get('toUser');
    if (!toUser) {
        throw 'Undefined toUser. Skipping push for Activity ' + req.object.get('type') + ' : ' + req.object.id;
        return;
    }

    const query = new Parse.Query(Parse.Installation);
    query.equalTo('user', toUser);
    Parse.Push.send({
        where: query,
        data : alertPayload(req)
    }).then(res.success, res.error)

}

function alertPayload(req) {

    if (req.object.get('type') === 'comment') {
        return {
            alert: alertMessage(req), // Set our alert message.
            badge: 'Increment', // Increment the target device's badge count.
            // The following keys help Anypic load the correct photo in response to this push notification.
            p    : 'a', // Payload Type: Activity
            t    : 'c', // Activity Type: Comment
            fu   : req.object.get('fromUser').id, // From User
            pid  : req.object.id // Photo Id
        };
    } else if (req.object.get('type') === 'like') {
        return {
            alert: alertMessage(req), // Set our alert message.
            // The following keys help Anypic load the correct photo in response to this push notification.
            p    : 'a', // Payload Type: Activity
            t    : 'l', // Activity Type: Like
            fu   : req.object.get('fromUser').id, // From User
            pid  : req.object.id // Photo Id
        };
    } else if (req.object.get('type') === 'follow') {
        return {
            alert: alertMessage(req), // Set our alert message.
            // The following keys help Anypic load the correct photo in response to this push notification.
            p    : 'a', // Payload Type: Activity
            t    : 'f', // Activity Type: Follow
            fu   : req.object.get('fromUser').id // From User
        };
    }
}

function alertMessage(req) {
    var message = '';

    if (req.object.get('type') === 'comment') {
        if (req.user.get('name')) {
            message = req.user.get('name') + ': ' + req.object.get('content').trim();
        } else {
            message = 'Someone commented on your photo.';
        }
    } else if (req.object.get('type') === 'like') {
        if (req.user.get('name')) {
            message = req.user.get('name') + ' likes your photo.';
        } else {
            message = 'Someone likes your photo.';
        }
    } else if (req.object.get('type') === 'follow') {
        if (req.user.get('name')) {
            message = req.user.get('name') + ' is now following you.';
        } else {
            message = 'You have a new follower.';
        }
    }

    // Trim our message to 140 characters.
    if (message.length > 140) {
        message = message.substring(0, 140);
    }

    return message;
}
function create(obj, acl) {

    let gallery = new ParseObject()
        .set('action', obj.action)
        .set('isApproved', true)
        .set('fromUser', obj.fromUser);

    if (obj.toUser) {
        gallery.set('toUser', obj.user)
    }

    if (obj.gallery) {
        gallery.set('gallery', obj.gallery);
    }

    if (acl) {
        gallery.setACL(acl);
    }

    return gallery.save();
}
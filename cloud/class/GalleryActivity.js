'use strict';
const _           = require('lodash');
const User        = require('./../class/User');
const ParseObject = Parse.Object.extend('GalleryActivity');

module.exports = {
    afterSave: afterSave,
    create   : create,
    feed     : feed,
};

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

    let newActivity = new ParseObject()
        .set('action', obj.action)
        .set('isApproved', true)
        .set('fromUser', obj.fromUser);
    

    if (acl) {
        newActivity.setACL(acl);
    }

    if (obj.gallery) {
        newActivity.set('gallery', obj.gallery);
        new Parse.Query('Gallery').include('user').equalTo('objectId', obj.gallery.id).first().then(gallery=> {

            newActivity.set('toUser', gallery.get('user'))
                       .save(null, {useMasterKey: true})
                       .then(success=>console.log('comemntTotal', success), error=>console.log('Got an error ' + error.code + ' : ' + error.message));
        })

    } else {
        newActivity.save(null, {useMasterKey: true})
                   .then(success=>console.log('comemntTotal', success), error=>console.log('Got an error ' + error.code + ' : ' + error.message));
    }


}

function feed(req, res, next) {
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 10;

    console.log('Start feed', req.params);

    let _query = new Parse.Query(ParseObject);

    _query
        .descending('createdAt')
        .limit(_limit)
        .include('gallery')
        .skip((_page * _limit) - _limit)
        .find()
        .then(data=> {
            let _result = [];

            console.log(data);

            if (!data.length) {
                res.success(_result);
            }

            let cb = _.after(data.length, ()=> {
                res.success(_result);
            });

            _.each(data, item=> {

                let userGet = item.get('fromUser');
                new Parse.Query('UserData').equalTo('user', userGet).first().then(user=> {

                    let obj = {
                        item     : item,
                        action   : item.get('action'),
                        createdAt: item.get('createdAt'),
                    };

                    if (user) {
                        obj.user = {
                            userObj: user,
                            id     : user.id,
                            name   : user.get('name'),
                            status : user.get('status'),
                            photo  : user.get('photo')
                        }
                    }

                    console.log('Obj', obj);

                    // Comments
                    _result.push(obj);
                    cb();
                }, err=>console.log);

            });


        }, error=> res.error(error.message));
}
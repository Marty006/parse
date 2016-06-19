'use strict';
const Image           = require('../helpers/image');
const User            = require('./../class/User');
const GalleryActivity = require('./../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('GalleryComment');
module.exports        = {
    beforeSave: beforeSave,
    afterSave : afterSave
};

function beforeSave(req, res) {
    var comment = req.object;
    var user    = req.user;
    var gallery = comment.get('gallery');

    if (!user) {
        return res.error('Not Authorized');
    }

    comment.set('user', user);

    if (!comment.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        acl.setWriteAccess(user, true);
        comment.setACL(acl);
        comment.set('isInappropriate', false);
    }

    return res.success();
}

function afterSave(req, res) {
    const comment = req.object;

    let activity = {
        action  : 'photoCommented',
        fromUser: req.user,
        gallery : comment.get('gallery')
    };

    console.log('after comment', activity);
    GalleryActivity.create(activity);
    User.incrementComment(req.user);
}
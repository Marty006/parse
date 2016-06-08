'use strict';
const Image    = require('../../helpers/image');
module.exports = {
    beforeSave: beforeSave,
    afterSave: afterSave
};

function beforeSave(req, res) => {
    var comment  = req.object;
    var user     = req.user;
    var userData = comment.get('userData');
    var gallery  = comment.get('gallery');

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!comment.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        acl.setWriteAccess(user, true);
        comment.setACL(acl);
        comment.set('isInappropriate', false);
    }

    if (comment.existed() && comment.dirty('isInappropriate')) {
        return res.success();
    }

    var query = new Parse.Query('Comment');
    query.equalTo('userData', userData);
    query.equalTo('gallery', gallery);

    query.find({
        success: res1 => {
            if (res1.length > 0) {
                res.error('You already write a comment for this gallery');
            } else {

                if (comment.get('rating') < 1) {
                    res.error('You cannot give less than one star');
                } else if (comment.get('rating') > 5) {
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
}

function afterSave(req, res)=> {
    var comment   = req.object;
    var rating    = comment.get('rating');
    var galleryId = comment.get('gallery').id;

    var query = new Parse.Query('Gallery');

    query.get(galleryId).then(gallery=> {

        var currentTotalRating = gallery.get('ratingTotal') || 0;

        gallery.increment('ratingCount');
        gallery.set('ratingTotal', currentTotalRating + rating);
        gallery.save(null, {useMasterKey: true});

    }, error=>console.log('Got an error ' + error.code + ' : ' + error.message));

}
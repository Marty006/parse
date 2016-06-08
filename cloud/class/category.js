'use strict';
const Image    = require('../../helpers/image');
module.exports = {
    beforeSave: beforeSave
};

function beforeSave(req, res) => {
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
        return Image.saveImage(base64);
    }).then(function (savedFile) {
        category.set('image', savedFile);
        return Image.resize(imageUrl, 160, 160);
    }).then(function (base64) {
        return Image.saveImage(base64);
    }).then(savedFile=> {
        category.set('imageThumb', savedFile);
        res.success();
    }, error=> res.error(error.message));


}
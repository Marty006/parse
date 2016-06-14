'use strict';
const ParseObject = Parse.Object.extend('GalleryActivity');
module.exports    = {
    create: create
};

function create(obj, acl) {

    console.log(obj);

    let gallery = new ParseObject()
        .set('action', obj.action)
        .set('isApproved', true)
        .set('user', obj.user);

    if (obj.gallery) {
        gallery.set('gallery', obj.gallery);
    }

    if (acl) {
        gallery.setACL(acl);
    }

    return gallery.save();
}
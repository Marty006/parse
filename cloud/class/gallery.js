'use strict';
const Image    = require('../../helpers/image');
module.exports = {
    isGalleryLiked: (req, res, next) => {
        const user      = req.user;
        const galleryId = req.params.galleryId;

        if (!user) {
            return res.error('Not Authorized');
        }

        var query = new Parse.Query('Gallery');
        query.equalTo('likes', user);
        query.equalTo('objectId', galleryId);

        query.first({useMasterKey: true})
             .then(place=>res.success(place ? true : false), error=> res.error(error.message));
    },
    likeGallery: (req, res, next)=> {
        const user      = req.user;
        const galleryId = req.params.galleryId;

        if (!user) {
            return res.error('Not Authorized');
        }

        const query  = new Parse.Query('Gallery');
        var objGallery;
        var response = {action: null};

        query.get(galleryId)
             .then(place=> {
                 objGallery     = place;
                 var queryPlace = new Parse.Query('Gallery');
                 queryPlace.equalTo('likes', user);
                 queryPlace.equalTo('objectId', galleryId)
                 return queryPlace.find();
             })
             .then(result=> {
                 var relation = objGallery.relation('likes');

                 if (result.length > 0) {
                     objGallery.increment('likeCount', -1);
                     relation.remove(user);
                     response.action = 'unlike';
                 } else {
                     objGallery.increment('likeCount');
                     relation.add(user);
                     response.action = 'like';
                 }

                 return objGallery.save(null, {useMasterKey: true});
             })
             .then(() =>res.success(response), error=> res.error(error.message));
    },
    beforeSave: (req, res) => {

        const gallery     = req.object;
        const user        = req.user;
        const isMasterKey = req.master;

        if (!gallery.existed()) {
            var acl = new Parse.ACL();
            acl.setPublicReadAccess(true);
            acl.setRoleWriteAccess('Admin', true);
            acl.setWriteAccess(user, true);
            gallery.setACL(acl);
        }

        if (isMasterKey) {
            return res.success();
        }

        if (!user) {
            return res.error('Not Authorized');
        }

        if (!gallery.get('image')) {
            return res.error('Upload the first image');
        }

        if (gallery.dirty('title') && gallery.get('title')) {
            gallery.set('canonical', gallery.get('title').toLowerCase());
        }

        if (!gallery.dirty('image')) {
            return res.success();
        }

        var promises = [];

        if (gallery.dirty('image')) {
            var url = gallery.get('image').url();

            var promise = Image.resize(url, 640, 640).then(function (base64) {
                return Image.saveImage(base64);
            }).then(function (savedFile) {
                gallery.set('image', savedFile);
            });

            promises.push(promise);

            var promiseThumb = Image.resize(url, 160, 160).then(function (base64) {
                return Image.saveImage(base64);
            }).then(function (savedFile) {
                gallery.set('imageThumb', savedFile);
            });

            promises.push(promiseThumb);
        }
        Parse.Promise.when(promises).then(success=>res.success(success), error=> res.error(error.message));
    }
};
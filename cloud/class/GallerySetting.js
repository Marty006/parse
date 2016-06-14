'use strict';
const _           = require('lodash');
const ParseObject = Parse.Object.extend('GallerySetting');
module.exports    = {
    start : start,
    create: create
};

function start(acl) {
    console.log('Start Setting');
    // Setting Create
    let promises = [];
    let settings = require('../data/setting.json');

    _.each(settings, (setting)=> {
        console.log('Setting ', setting);
        promises.push(create(setting, acl));
    })

    return Parse.Promise.when(promises);
}

function create(obj, acl) {
    let gallery = new ParseObject()
        .set('key', obj.key)
        .set('value', obj.value);

    if (acl) {
        gallery.setACL(acl);
    }

    return gallery.save();
}
'use strict';
module.exports = {
    beforeSave: beforeSave
};

function beforeSave(req, res) {
    Parse.Cloud.useMasterKey();
    if (req.user) {
        req.object.set('user', req.user);
    } else {
        req.object.unset('user');
    }
    res.success();
}
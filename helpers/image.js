'use strict';
const Jimp = require('jimp');

module.exports = {
    resize: (url, width, height) => {
        return Jimp.read(url).then((image) => {

            var size = Math.min(image.bitmap.width, image.bitmap.height);
            var x    = (image.bitmap.width - size) / 2;
            var y    = (image.bitmap.height - size) / 2;

            var imageResized = image.crop(x, y, size, size).resize(width, height).quality(60);

            return imageResized.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
                var base64 = buffer.toString('base64');
                return new Parse.Promise.as(base64);
            })

        }).catch(err=> {
            console.log(err);
            return Parse.Promise.error({
                message: 'Unable to read image',
                code: 200
            });
        });
    },
    saveImage: function  (base64) {
        return Parse.File('image.jpg', {base64: base64}).save();
    }
}

/**
 * util.js
 * ----
 *
 */
'use strict';

const crypto = require('crypto');

let id = null;

// generates a peerId used to uniquely identify our torrent client
module.exports.genId = () => {
    if (!id) {
        id = crypto.randomBytes(20);
        Buffer.from('-AT0001-').copy(id, 0);
    }
    return id;
};

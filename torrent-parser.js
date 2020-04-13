/**
 * torrent-parser.js
 * ----
 * Code related getting information out of a torrent file.
 * Code for opening a torrent file has been moved here as well.
 */

'use strict';

const fs = require('fs');
const bencode = require('bencode');

const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath));
};

const size = (torrent) => {
    // ...
};

const infoHash = (torrent) => {
    // ...
};

module.exports = {
    open,
    size,
    infoHash,
};

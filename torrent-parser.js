/**
 * torrent-parser.js
 * ----
 * Code related getting information out of a torrent file.
 * Code for opening a torrent file has been moved here as well.
 */

'use strict';

const fs = require('fs');
const bencode = require('bencode');
const bignum = require('bignum');

const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath));
};

const size = (torrent) => {
    const size = torrent.info.files
        ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
        : torrent.info.length;
    return bignum.toBuffer(size, { size: 8 });
};

/**
 * Why use a SHA1 hashing function?
 * - SHA1 is one of many hashing functions but it’s the one used by bittorrent so in our case no other hashing function will do.
 * - We want to use a hash because it’s a compact way to uniqely identify the torrent.
 * - A hashing function returns a fixed length buffer (in this case 20-bytes long).
 * - For example, our example torrent would output <Buffer 11 7e 3a 66 65 e8 ff 1b 15 7e 5e c3 78 23 57 8a db 8a 71 2b>.
 *
 * Because it’s very unlikely for two inputs to output the same hash value,
 * and because the input (the info property) contains information about every piece of the torrent’s files,
 * it’s a good way to uniquely identify a torrent.
 *
 * That’s why we must send the info hash as part of the request to the tracker,
 * we’re saying we want the list of peers that can share this exact torrent.
 */
const infoHash = (torrent) => {
    const info = bencode.encode(torrent.info);
    return crypto.createHash('sha1').update(info).digest();
};

module.exports = {
    open,
    size,
    infoHash,
};

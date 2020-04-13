/**
 * Tracker: Get a list of peers from tracker
 * ----
 * 1. Send a connect request
 * 2. Get the connect response and extract the connection id
 * 3. Use the connection id to send an announce request - this is where we tell
 *    the tracker which files we’re interested in
 * 4. Get the announce response and extract the peers list
 */

'use strict';

const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;

// 1 - we require the built-in crypto module to help us create a random number for our buffer.
const crypto = require('crypto');

const torrentParser = require('./torrent-parser');
const util = require('./util');

const getPeers = (torrent, callback) => {
    const socket = dgram.createSocket('udp4');
    const url = torrent.announce.toString('utf8');

    // 1. send connect request
    udpSend(socket, buildConnReq(), url);

    socket.on('message', (response) => {
        if (respType(response) === 'connect') {
            // 2. receive and parse connect response
            const connResp = parseConnResp(response);
            // 3. send announce request
            const announceReq = buildAnnounceReq(connResp.connectionId);
            udpSend(socket, announceReq, url);
        } else if (respType(response) === 'announce') {
            // 4. parse announce response
            const announceResp = parseAnnounceResp(response);
            // 5. pass peers to callback
            callback(announceResp.peers);
        } else {
            console.log('something else happened...');
        }
    });
};

/**
 * udpSend is just a convenience function that mostly just calls socket.send
 * but lets me avoid having to set the offset and length arguments
 */
function udpSend(socket, message, rawUrl, callback = () => {}) {
    const url = urlParse(rawUrl);
    socket.send(message, 0, message.length, url.port, url.host, callback);
}

/**
 * respType will check if the response was for the connect or the announce request.
 * Since both responses come through the same socket, we want a way to distinguish them.
 */
function respType(resp) {
    const action = resp.readUInt32BE(0);
    if (action === 0) return 'connect';
    if (action === 1) return 'announce';
}

/**
 * Offset  Size            Name            Value
 * 0       64-bit integer  connection_id   0x41727101980
 * 8       32-bit integer  action          0 // connect
 * 12      32-bit integer  transaction_id  ? // random
 * 16
 * <Buffer 00 00 04 17 27 10 19 80 00 00 00 00 a6 ec 6b 7d>
 */
function buildConnReq() {
    // 2 - we create a new empty buffer with a size of 16 bytes since
    // we already know that the entire message should be 16 bytes long
    const buf = Buffer.alloc(16);

    /**
     * 3 - connection ID
     * Here we write the the connection id, which should always be 0x41727101980
     * We use the method writeUInt32BE which writes an unsigned 32-bit integer in big-endian format.
     * We pass the number 0x417 and an offset value of 0.
     * And then again the number 0x27101980 at an offset of 4 bytes.
     * NOTE: we are writing in 4-bit chunks
     * node.js doesnt support writing 64-bit numbers, so we are creating a
     * 64-bit number by creating two 32-bit numbers
     */
    buf.writeUInt32BE(0x417, 0);
    buf.writeUInt32BE(0x27101980, 4);

    // 4 - action
    // Next we write 0 for the action into the next 4 bytes, setting the
    // offset at 8 bytes since just wrote an 8 byte integer.
    // This values should always be 0 for the connection request.
    buf.writeUInt32BE(0, 8);

    // 5 - transaction ID
    // For the final 4 bytes we generate a random 4-byte buffer using crypto.randomBytes
    // which is a pretty handy way of creating a random 32-bit integer.
    // To copy that buffer into our original buffer we use the copy method
    // passing in the offset we would like to start writing at.
    crypto.randomBytes(4).copy(buf, 12);
}

/**
 * Offset  Size            Name            Value
 * 0       32-bit integer  action          0 // connect
 * 4       32-bit integer  transaction_id
 * 8       64-bit integer  connection_id
 * 16
 */
function parseConnResp(resp) {
    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        connectionId: resp.slice(8),
    };
}

/**
 * Offset  Size    Name    Value
 * 0       64-bit integer  connection_id
 * 8       32-bit integer  action          1 // announce
 * 12      32-bit integer  transaction_id
 * 16      20-byte string  info_hash
 * 36      20-byte string  peer_id
 * 56      64-bit integer  downloaded
 * 64      64-bit integer  left
 * 72      64-bit integer  uploaded
 * 80      32-bit integer  event           0 // 0: none; 1: completed; 2: started; 3: stopped
 * 84      32-bit integer  IP address      0 // default
 * 88      32-bit integer  key             ? // random
 * 92      32-bit integer  num_want        -1 // default
 * 96      16-bit integer  port            ? // should be betwee
 * 98
 *
 * port:
 *  official spec says that the ports for bittorrent should be
 *  between 6881 and 6889, so I’ve decided to use a default of 6681.
 */
function buildAnnounceReq(connId, torrent, port = 6881) {
    const buf = Buffer.allocUnsafe(98);

    // connection id
    connId.copy(buf, 0);
    // action
    buf.writeUInt32BE(1, 8);
    // transaction id
    crypto.randomBytes(4).copy(buf, 12);
    // info hash
    torrentParser.infoHash(torrent).copy(buf, 16);
    // peerId - used to uniquely identify your client
    util.getId().copy(buf, 36);
    // downloaded
    Buffer.alloc(8).copy(buf, 56);
    // left
    torrentParser.size(torrent).copy(buf, 64);
    // uploaded
    Buffer.alloc(8).copy(buf, 72);
    // event
    buf.writeUInt32BE(0, 80);
    // ip address
    buf.writeUInt32BE(0, 80);
    // key
    crypto.randomBytes(4).copy(buf, 88);
    // num want - NOT UInt (because the num is negative we can't use unsigned integer)
    buf.writeInt32BE(-1, 92);
    // port
    buf.writeUInt16BE(port, 96);

    return buf;
}

/**
 * PARSE THE ANNOUNCEMENT RESPONSE
 * ----
 * It’s a bit tricky because the number of addresses that come back isn’t fixed.
 * The addresses come in groups of 6 bytes, the first 4 represent the IP address
 * and the next 2 represent the port. So our code will need to correctly
 * break up the addresses part of the response.
 *
 *
 * Offset      Size            Name            Value
 * 0           32-bit integer  action          1 // announce
 * 4           32-bit integer  transaction_id
 * 8           32-bit integer  interval
 * 12          32-bit integer  leechers
 * 16          32-bit integer  seeders
 * 20 + 6 * n  32-bit integer  IP address
 * 24 + 6 * n  16-bit integer  TCP port
 * 20 + 6 * N
 */
function parseAnnounceResp(resp) {
    function group(iterable, groupSize) {
        let groups = [];
        for (let i = 0; i < iterable.length; i += groupSize) {
            groups.push(iterable.slice(i, i + groupSize));
        }
        return groups;
    }

    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        leechers: resp.readUInt32BE(8),
        seeders: resp.readUInt32BE(12),
        peers: group(resp.slice(20), 6).map((address) => {
            return {
                ip: address.slice(0, 4).join('.'),
                port: address.readUInt16BE(4),
            };
        }),
    };
}

module.exports = { getPeers };

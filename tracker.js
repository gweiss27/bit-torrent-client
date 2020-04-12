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

function udpSend(socket, message, rawUrl, callback = () => {}) {
    const url = urlParse(rawUrl);
    socket.send(message, 0, message.length, url.port, url.host, callback);
}

function respType(resp) {
    // ...
}

function buildConnReq() {
    // ...
}

function parseConnResp() {
    // ...
}

function buildAnnounceReq(connId) {
    // ...
}

function parseAnnounceResp(resp) {
    // ...
}

module.exports = getPeers;

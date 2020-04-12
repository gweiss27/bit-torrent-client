'use strict';

const fs = require('fs');
const bencode = require('bencode');

// 1 - require 3 modules from standard library
const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;

const torrent = bencode.decode(fs.readFileSync('puppy.torrent'));

// 2 creates object of url for easy access to port, host, etc..
const url = urlParse(torrent.announce.toString('utf8'));

// 3 create a new ip4 udp socket instance
const socket = dgram.createSocket('udp4');

// 4 messages m ust be in the form of buffers (this converts string to a buffer)
const myMsg = Buffer.from('hello?', 'utf8');

console.log({ myMsg, url });

// 5 send message (0 is the offset, 0 means we send the entire buffer)
socket.send(myMsg, 0, myMsg.length, url.port, url.host, () => {
    console.log('message sent');
});

// 6 handle incoming message
socket.on('message', (msg) => {
    console.log('message is', msg);
});

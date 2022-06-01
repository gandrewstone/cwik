'use strict';

var bitcore = require("bitcore-lib");
var nexaaddr = require("nexaaddrjs");
//var buffer = require("buffer");

//var Message = bitcore.Message;
//var AddrFormat = bchaddr.AddrFormat;
//import { Message } from 'bitcore-lib';
//import AddrFormat from 'bchaddrjs';

/**
 * [fixAddressFormat Converts Bitcoin Cash and Bitpay addresses to legacy addresses before verifiation.]
 * @param  {String} address [The original address.]
 * @return {String}         [The corresponding legacy address.]
 */
const fixAddressFormat = address => {
    let addrBytes = nexaaddr.decode(address);
    console.log("decoded nexaaddr:");
    console.log(addrBytes);
    let buf = addrBytes.hash.buffer.slice(1,21);  // ignore the type byte
    let buf2 = Buffer.from(buf);
    console.log(buf);
    console.log(buf2);
    return bitcore.Address.fromPublicKeyHash(buf2, "livenet")
    // return !bchaddr.isLegacyAddress(address) ? bchaddr.toLegacyAddress(address) : address;
}

/*
 * Verify the message
 * { challenge: {string}, address: {string}, signature: {string} }
 * Note: Bitcore causes errors when non-signature strings are passed as the signature param
 */
/**
 * [messageVerify Fixes the address type and then verifies the message via Bitcore.]
 * @param  {Object} message [Object containing the challenge, pubkey and signature.]
 * @return {Boolean}         [true/false result.]
 */
const messageVerify = message => {
    let {
        challenge,
        pubkey,
        signature
    } = message;
    console.log("challenge: '" + challenge + "'");
    console.log("signature: '" + signature + "'");
    console.log("pubkey: '" + pubkey + "'");
    const fixedAddress = fixAddressFormat(pubkey);
    console.log("fixed pubkey: " + fixedAddress);
    try {
        return new bitcore.Message(challenge).verify(fixedAddress, signature);
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

module.exports = {
    fixAddressFormat,
    messageVerify
}

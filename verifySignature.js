'use strict';

var bitcore = require("bitcore-lib");
var bchaddr = require("bchaddrjs");

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
    return !bchaddr.isLegacyAddress(address) ? bchaddr.toLegacyAddress(address) : address;
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
    const fixedPubKey = fixAddressFormat(pubkey);
    console.log("fixed pubkey: " + fixedPubKey);
    try {
        return new bitcore.Message(challenge).verify(fixedPubKey, signature);
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

module.exports = {
    fixAddressFormat,
    messageVerify
}
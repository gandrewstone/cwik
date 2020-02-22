var verifySignature = require("./verifySignature.js");

strings = {
    "wordpool": "a purely peertopeer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution digital signatures provide part of the solution but the main benefits are lost if a trusted third party is still required to prevent doublespending we propose a solution to the double spending problem using a peertopeer network the network timestamps transactions by hashing them into an ongoing chain of hash based proof of work forming a record that cannot be changed without redoing the proofofwork the longest chain not only serves as proof of the sequence of events witnessed but proof that it came from the largest pool of cpu power As long as a majority of cpu power is controlled by nodes that are not cooperating to attack the network they will generate the longest chain and outpace attackers the network itself requires minimal structure messages are broadcast on a best effort basis and nodes can leave and rejoin the network at will accepting the longest proofofwork chain as proof of what happened while they were gone"
};

/**
 * [getChallengeString Builds the auth challenge string]
 * @param  {undefined} _ [ignored param]
 * @return {String}   [Returns 12 word challenge to be signed.]
 */
getChallengeString = _ => {
    let wordArr = strings.wordpool.split(' ');
    let challenge = wordArr[Math.floor(Math.random()*wordArr.length)];
    wordCount = 12;
    for (var i=1; i < wordCount; i++) {
        challenge += "_" + wordArr[Math.floor(Math.random()*wordArr.length)];
    }
    return challenge.trim()
}




verifySig = function(challenge, addr, signature) {
    console.log("verifysig: " + addr);
    var result = verifySignature.messageVerify({challenge: challenge, pubkey: addr, signature: signature});
    console.log(result);
    return result;
}

/**
 * [signatureVerify Multi-level checks for signature integrity.]
 * @param  {Object} data [The signature object.]
 * @return {Object}      [The token to be passed to the user for future write transaction validation.]
 */
const signatureVerify = data => new Promise((resolve, reject) => {
    const { pubkey, challenge, signature, uid } = data;
    if (!isStr(pubkey) || !isStr(challenge) || !isStr(signature) || !isStr(uid)) {
        reject(rejectWithLog('signatureVerify(): Missing data for messageVerify.'));
    }
    realmGetSecure('Challenge', uid).then(result => {
        if (!result || !result.challenge || result.challenge !== challenge) {
            throw 'Invalid challenge';
        } else {
            /*
             * Check if the pubkey is an adminstrator
             */
            isAdmin(pubkey).then(res => {
                if (messageVerify(data)) {
                    const expires = Math.floor(Date.now() / 1000) + Number(authExiprationSeconds);
                    insertAuth({ pubkey, challenge, signature, expires }).then(res => {
                        if (!res.pubkey || !res.challenge || !res.signature || !res.expires) throw 'Missing required jwt data.';
                        /*
                         * If auth makes it to this point, build the auth token.
                         * This token will be stored in local storage and used to validate
                         * future secure read, write and delete operations.
                         */
                        const token = jwt.sign({
                            pubkey: res.pubkey,
                            challenge: res.challenge,
                            signature: res.signature,
                            expires: res.expires
                        }, process.env.JWT_SECRET);
                        if (!token) throw 'Token creation error.';
                        resolve(token);
                    }).catch(e => reject(eToStr(e)));
                } else {
                    reject(rejectWithLog('signatureVerify(): Challenge could not be verified.'));
                }
            }).catch(e => {
                reject(rejectWithLog(eToStr(e)));
            });
        }
    }).catch(e => {
        reject(rejectWithLog(eToStr(e)));
    });
});

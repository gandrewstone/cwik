let USER_FILE = 'knownusers.json';

var fs = require('fs').promises;
var path = require('path');
var config = require('./config');

var users = config.USERS;

(async () => {
    let hdl = await fs.open(USER_FILE, 'r');
    let read = await hdl.readFile({ encoding: "utf-8" });
    let addedUsers = JSON.parse(read);

    for (let key in addedUsers) {
        users[key] = addedUsers[key]
    }
    hdl.close();
})();

exports.known = function(identity) {
    return users[identity];
}

// Create a new user, with only edit proposal and comment privileges
exports.create = function(identity, handle, email) {
    users[identity] = { "hdl": handle, "email": email, "push": false, "merge": false, "propose": true, "comment":true }
};

exports.save = async function() {
    await fs.writeFile(USER_FILE, JSON.stringify(users));
};

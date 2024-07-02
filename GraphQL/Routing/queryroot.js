const sessions = require("../../Storage/usersessions").SessionManager;

console.log(sessions)

let root = {
    getSession({ id }) {
        let session = sessions.getSession(id);

        return session;
    },

    createSession({ name }) {
        let session = sessions.createSession(name);

        try {
            return session;
        } catch (e) {
            console.log(e);
            return null;
        }
    }
}

module.exports = {
    root
}
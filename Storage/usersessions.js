const { v4: uuidv4 } = require('uuid');

class SessionManager {
    static sessions = {};

    static createSession(name) {
        let id = uuidv4();
        if (this.sessions[id] === undefined) {
            let newSession = new Session(id, name);
            this.sessions[id] = newSession;
            console.log(this.sessions[id]);

            return newSession;
        } else {
            throw new Error("Session ID Conflict")
        }
    }

    static getSession(id) {
        let session = this.sessions[id];

        return session;
    }
}

class Session {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
}



module.exports = {
    SessionManager
}
const { SessionManager } = require("../../Storage/usersessions");

let sessions = new SessionManager();

// GraphQL Resolvers
let root = {
    // Resolver for getSession Query
    // ARGS:
    // id -- ID of the session to fetch
    // OUTPUT:
    // Returns session object with matching ID.
    getSession({ id }) {
        let session = sessions.getSession(id);

        return session;
    },

    // Creates a session and stores it in the SessionManager
    // ARGS:
    // name -- Name of the user / session.
    // OUTPUT:
    // Creates a session. Returns it, and stores it in SessionManager.
    createSession({ name }) {
        let session = sessions.createSession(name);

        return session;
    },

    // Resolver for killSession
    // Kills a session, freeing up it's memory.
    // ARGS:
    // id -- ID of the session to kill.
    // OUTPUT:
    // Asks the SessionManager to kill the requested
    killSession({ id }) {
        SessionManager.killSession(id);
    },

    // Add a new message onto the session's GuideAgent thread.
    // ARGS:
    // id -- ID of the user's session
    // request -- The content of the message to add to the thread.
    // OUTPUT:
    // Makes a call to the OpenAI API. Adds message to the thread and then runs it.
    // Returns a promise on API call completion which resolves to the message content.
    // Sends current session state as GraphQL response.
    appendThread({ id, request }) {
        let session = sessions.getSession(id);
        return session.appendGuideThread(request).then(res => {
            return session;
        });
    },

    // Gets the message history for a session.
    // ARGS:
    // id -- The user's session.
    // OUTPUT:
    // An array of Objects, each containing a sender and body, representing each message in the Guide Agent conversation.
    getLog({ id }) {
        let session = sessions.getSession(id);
        let log = session.conversationLog;
        return log;
    },

    // Gets the latest message from the Guide Agent
    // ARGS:
    // id -- The user's session
    // OUTPUT:
    // An object, containing the sender and body for the latest message from the Guide Agent.
    getLatest({ id }) {
        let session = sessions.getSession(id);
        let log = session.conversationLog;
        return log[log.length - 1];
    },
}

module.exports = {
    root
}
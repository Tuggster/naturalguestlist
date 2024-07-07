const { v4: uuidv4 } = require('uuid');
let openaiGuide = require('../OpenAI/guideagent.js');
let openaiParse = require('../OpenAI/parseagent.js');
let guideAgent = openaiGuide.OpenAIGuideAgent;
let parseAgent = openaiParse.OpenAIParseAgent;

// For Session Logging
const files = require('fs')
const path = require('path');
const { time } = require('console');
const { setTimeout } = require('timers');

const garbageCollectorInterval = 5; // Garbage Collector Interval in minutes.

class SessionManager {

    constructor() {
        this.sessions = {};
        this.gcTimeout = setTimeout(() => {
            this.triggerGarbageCollector();
        }, garbageCollectorInterval * 1000 * 60);
    }

    // Creates a session via name and stores in SessionManger
    // ARGS:
    // Name -- Any human-readable name, used for keeping track of sessions.
    // OUTPUT:
    // Stores new session in sessions, returns session.
    createSession(name) {
        let prom = new Promise((resolve, reject) => {
            let id = uuidv4();

            // In the event of (almost entirely impossible) UUID collisions, reroll
            while (typeof this.sessions[id] !== 'undefined' && this.sessions[id]) {
                id = uuidv4();
            }

            let newSession = new Session(id, name);

            newSession.initAgents().then(res => {
                this.sessions[id] = newSession;
                console.log(this.sessions[id]);

                newSession.beginConversation().then(res => {
                    resolve(newSession);
                });
            });
        })

        return prom;
    }

    triggerGarbageCollector() {

        if (!sessions) {
            return;
        }

        let currentDate = new Date();
        console.log("collecting garbage at: " + currentDate);
        this.sessions.forEach(session => {
            let sessionExpirationTime = session.lastInteraction.getTime() + (garbageCollectorInterval * 1000 * 60);
            if (currentDate > sessionExpirationTime) {
                this.killSession(session.id);
                console.log("GC killed session: " + session.name);
            }
        });
    }

    killSession(id) {
        let session = this.sessions[id];

        if (session) {
            session.cleanup();
            delete this.sessions[id];
        } else {
            throw new Error("No session to kill.")
        }
    }

    // Gets a session by ID.
    // ARGS:
    // id -- Session ID for retrieval.
    // OUTPUT:
    // Returns Session with matching id.
    // Throws error if no session found.
    getSession(id) {
        let session = this.sessions[id];


        if (session) {
            return session;
        } else {
            throw new Error("No matching session found.")
        }
    }
}

class Session {
    // Construct a Session object.
    // ARGS:
    // ID -- Session ID
    // Name -- Session human-readable name
    constructor(id, name) {
        this.id = id;
        this.name = name;

        this.openAIInit = false;
        this.guideAgent = undefined;
        this.parseAgent = undefined;
        this.conversationLog = Array();

        this.state = "ready";
        this.lastInteraction = new Date();
        this.result = undefined;
    }

    // Getter for conversationLog
    getLog() {
        return this.conversationLog;
    }

    // Initialize all OpenAI Agents and set ready flag.
    // OUTPUT:
    // Sets ready flag. Stores guideAgent and parseAgent
    initAgents() {
        let prom = new Promise((resolve, reject) => {
            this.guideAgent = new guideAgent(this.id);
            this.guideAgent.initAgent().then(res => {
                this.openAIInit = true;
                console.log(res);
                resolve(res);
            });
        })

        this.parseAgent = new parseAgent(this.id);

        return prom;
    }

    // Begins the conversation and generates the initial response from the Assistant.
    // OUTPUT:
    // Returns a promise, resolves with no parameters once the first generation is complete.
    beginConversation() {
        let prom = new Promise((resolve, reject) => {
            this.appendGuideThread("From now on you will be speaking to the client. Begin conversation.").then((res) => {
                resolve();
            });
        })

        return prom;
    }

    // Kills sessions with OpenAI and sets session state to done.
    async cleanup() {
        this.guideAgent.cleanup();
        this.state = "done";
    }

    // Appends a new message to the Guide Agent's thread and runs the thread.
    // ARGS:
    // Content -- Message to write to the OpenAI Thread.
    // OUTPUT:
    // Promise resolved on thread run success. Outputs response from the model.
    // Promise rejected if Guide Agent is not initialized.
    // Puts user request and assistant response in conversation log.
    appendGuideThread(content) {
        if (this.state != "ready") {
            throw new Error("Session not ready for input.");
        }

        if (!content || content.length === 0) {
            console.log("error.")
            throw new Error("Zero-length messages not allowed.")
        }

        let prom = new Promise(async (resolve, reject) => {
            // Make sure everything is ready.
            if (!this.openAIInit || !this.guideAgent) {
                reject("Not initialized");
                return;
            }

            this.state = "waiting";
            console.log("waiting.")

            // Add our content to the OpenAI Thread
            this.guideAgent.appendThread(content).then(thread => {
                // Run the thread and await the results
                this.guideAgent.runThread().then(res => {
                    this.state = "ready";
                    this.conversationLog.push({
                        role: "USER",
                        content,
                        index: this.conversationLog.length
                    });
                    this.conversationLog.push({
                        role: "ASSISTANT",
                        content: res,
                        index: this.conversationLog.length
                    });
                    console.log("resolved!")
                    console.log(res);

                    if (!this.checkForEOC(res)) {
                        resolve(res);
                    } else {
                        this.runParseAgent().then(parsed => {
                            console.log(parsed);
                            this.result = parsed.message.content;
                            resolve(parsed.message.content);
                            this.saveSessionLogs();
                        });
                    }

                    this.lastInteraction = new Date();

                });
            }).catch(error => {
                reject(error);
            })

        })

        return prom;
    }

    // Checks a response for an end of conversation flag
    // EOC flag indicates that the Guide Agent has finished it's job and that the parse agent needs to step in.
    // ARGS:
    // content -- Assistant response to be checked.
    // OUTPUT:
    // If EOC flag found, changes session state to done.
    // Formats conversation log and passes it off to parser agent to generate CSV.
    // Sets session state to "done" if EOC is found.
    checkForEOC(content) {
        if (content.includes("[END OF CONVERSATION]")) {
            this.state = "done"
            console.log("Guide agent finished.");
            return true;
        }

        return false;
    }

    // Dispatches the Parse Agent.
    // OUTPUT:
    // Returns a promise, containing the plaintext CSV results.
    // Promise is rejected if session is not in the "done" state.
    runParseAgent() {
        let prom = new Promise((resolve, reject) => {
            if (this.state == "done") {
                this.parseAgent.getCSVFromLog(this.conversationLog).then(res => {
                    console.log("parsed!")
                    console.log(res);
                    resolve(res);
                })
            } else {
                reject("Not ready!")
            }
        })

        return prom;
    }

    saveSessionLogs() {
        let sessionMetadata = {
            sessionID: this.id,
            userName: this.name,
            sessionMessageCount: this.conversationLog.length,
            openAIGuideID: this.guideAgent.agent.id,
            time: new Date()
        }
        let sessionChatlog = this.conversationToLog();

        let loggingPath = path.join(__dirname, `../logs/${this.name}`)
        if (!files.existsSync(loggingPath)) {
            files.mkdirSync(loggingPath);
        } else {
            if (!files.existsSync(`${loggingPath}/${this.id}`))
            files.mkdirSync(`${loggingPath}/${this.id}`);
            loggingPath = `${loggingPath}/${this.id}`;
        }

        files.writeFileSync(`${loggingPath}/sessioninfo.log`, JSON.stringify(sessionMetadata));
        files.writeFileSync(`${loggingPath}/chatlog.log`, sessionChatlog);
        if (this.state == "done") {
            files.writeFileSync(`${loggingPath}/output.log`, this.result.toString());
        }


    }

    conversationToLog() {
        let log = "";
        this.conversationLog.forEach(message => {
            log += (message.role == "USER" ? this.name : "Guide Agent") + ":\n";
            log += message.content + "\n\n";
        });
        return log;
    }
}

module.exports = {
    SessionManager
}
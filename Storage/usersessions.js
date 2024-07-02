const { v4: uuidv4 } = require('uuid');
let openaiGuide = require('../OpenAI/guideagent.js');
let openaiParse = require('../OpenAI/parseagent.js');
let guideAgent = openaiGuide.OpenAIGuideAgent;
let parseAgent = openaiParse.OpenAIParseAgent;

class SessionManager {
    static sessions = {};

    // Creates a session via name and stores in SessionManger
    // ARGS:
    // Name -- Any human-readable name, used for keeping track of sessions.
    // OUTPUT:
    // Stores new session in sessions, returns session.
    static createSession(name) {
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

    // Gets a session by ID.
    // ARGS:
    // id -- Session ID for retrieval.
    // OUTPUT:
    // Returns Session with matching id.
    // Throws error if no session found.
    static getSession(id) {
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

    // Appends a new message to the Guide Agent's thread and runs the thread.
    // ARGS:
    // Content -- Message to write to the OpenAI Thread.
    // OUTPUT:
    // Promise resolved on thread run success. Outputs response from the model.
    // Promise rejected if Guide Agent is not initialized.
    // Puts user request and assistant response in conversation log.
    async appendGuideThread(content) {
        if (this.state != "ready") {
            throw new Error("Session not ready for input.");
        }

        this.state = "waiting";
        let prom = new Promise(async (resolve, reject) => {
            // Make sure everything is ready.
            if (!this.openAIInit || !this.guideAgent) {
                reject("Not initialized");
                return;
            }

            // Add our content to the OpenAI Thread
            this.guideAgent.appendThread(content).then(thread => {
                // Run the thread and await the results
                this.guideAgent.runThread().then(res => {
                    this.state = "ready";
                    this.conversationLog.push({
                        role: "USER",
                        content
                    });
                    this.conversationLog.push({
                        role: "ASSISTANT",
                        content: res
                    });
                    console.log("resolved!")
                    console.log(res);

                    if (!this.checkForEOC(res)) {
                        resolve(res);
                    } else {
                        this.runParseAgent().then(parsed => {
                            console.log(parsed);
                            resolve(parsed.message.content);
                        });
                    }

                });
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
    checkForEOC(content) {
        if (content.includes("[END OF CONVERSATION]")) {
            this.state = "done"
            console.log("Guide agent finished.");
            return true;
        }

        return false;
    }

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
}

module.exports = {
    SessionManager
}
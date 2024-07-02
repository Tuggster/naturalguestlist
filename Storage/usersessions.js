const { v4: uuidv4 } = require('uuid');
let openaiInterface = require('../OpenAI/guideagent.js');
let guideAgent = openaiInterface.OpenAIGuideAgent;

class SessionManager {
    static sessions = {};

    static createSession(name) {
        let id = uuidv4();
        if (this.sessions[id] === undefined) {
            let newSession = new Session(id, name);

            newSession.initAgents();

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

        this.openAIInit = false;
        this.guideAgent = undefined;
        this.parseAgent = undefined;
        this.conversationLog = Array();
    }

    initAgents() {
        this.guideAgent = new guideAgent(this.id);
        this.guideAgent.initAgent().then(res => {
            this.openAIInit = true;
            console.log(res);
        });
    }

    async appendGuideThread(content) {
        
        let prom = new Promise(async (resolve, reject) => {
            if (!this.openAIInit) {
                reject("Not initialized");
                return;
            }
    
            this.guideAgent.appendThread(content).then(thread => {
                this.guideAgent.runThread().then(res => {
                    resolve(res);
                    console.log("resolved!")
                    console.log(res);
                });
            })    

        })

        return prom;
    }
}



module.exports = {
    SessionManager
}
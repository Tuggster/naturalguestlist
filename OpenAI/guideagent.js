const OpenAI = require("openai");
const openai = new OpenAI();

const fs = require("fs");
const path = require("path");
let promptPath = path.join(__dirname, "/guide.prompt")
const guidePrompt = fs.readFileSync(promptPath).toString();

class OpenAIGuideAgent {
    constructor(id) {
        this.sessionID = id;
        this.initialized = false;
        this.agent = undefined;
        this.thread = undefined;
    }

    async initAgent() {
        let prom = new Promise(async (resolve, reject) => {
            const assistant = await openai.beta.assistants.create({
                name: `Wedding Planner ${this.sessionID}`,
                instructions: guidePrompt,
                tools: [],
                model: "gpt-3.5-turbo"
            });
            const thread = await openai.beta.threads.create();
    
            this.agent = assistant;
            this.thread = thread;
            console.log(assistant);

            resolve("success")
    
        })

        return prom;
    }

    async appendThread(content) {
        let prom = new Promise(async (resolve, reject) => {
            const message = await openai.beta.threads.messages.create(
                this.thread.id,
                {
                    role: "user",
                    content: content
                }
            );
              
            console.log(message);
            resolve(message);
        })

        return prom;
    }

    async runThread() {
        let prom = new Promise((resolve, reject) => {
            const run = openai.beta.threads.runs.stream(this.thread.id, {
                assistant_id: this.agent.id
              })
                .on('event', (event) => {
                    console.log(event.event);
                    if (event.event == "thread.message.completed") {
                        console.log("COMPLETED!!!!");
                        console.log(event.data.content[0].text.value);
                        resolve(event.data.content[0].text.value);
                    }
                })
        })

        return prom;
    }
      
}

module.exports = {
    OpenAIGuideAgent
}
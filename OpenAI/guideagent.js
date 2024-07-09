const OpenAI = require("openai");
const openai = new OpenAI();

const fs = require("fs");
const path = require("path");
let promptPath = path.join(__dirname, "/guide.prompt")
const guidePrompt = fs.readFileSync(promptPath).toString();

class OpenAIGuideAgent {
    // Construct an OpenAIGuideAgent
    // Tracks an OpenAI Thread, and handles making requests.
    // ARGS:
    // ID -- ID of the Session that this agent belongs to.
    constructor(id) {
        this.sessionID = id;
        this.initialized = false;
        this.agent = undefined;
        this.thread = undefined;
    }

    // Registers our Guide Agent as an Assistant with the OpenAI API.
    // Sets up the system prompt, and sets the initialized flag for this OpenAIGuideAgent.
    // OUTPUT:
    // Creates the agent and stores it within this object.
    // Returns a promise.
    // Resolved when assistant successfully created.
    initAgent() {
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

            resolve("success")
            this.initialized = true;
        })

        return prom;
    }

    async cleanup() {
        await openai.beta.assistants.del(this.agent.id);
    }

    // Adds a new message onto the Assistant's thread.
    // ARGS:
    // content -- The content of the message to send to the Assistant.
    // role -- "Role" Metadata for the content. System, User, or Assistant.
    // OUTPUT:
    // Returns promise. Promise resolved when thread has been successfully updated.
    appendThread(content, role) {
        if (!this.initialized) {
            throw new Error("Agent not initialized.")
        }

        if (!content || content.length === 0) {
            throw new Error("Zero length messages not allowed.")
        }

        let prom = new Promise(async (resolve, reject) => {
            const message = await openai.beta.threads.messages.create(
                this.thread.id,
                {
                    role: role ? role : "user",
                    content: content
                }
            );

            resolve(message);
        })

        return prom;
    }

    // Runs the thread, processing the messages and returning the response from the Assistant.
    // OUTPUT:
    // Returns a promise. Resolved once LLM finishes generating a response.
    // Returns plain-text response from the assistant.
    runThread() {
        if (!this.initialized) {
            throw new Error("Agent not initialized.")
        }


        let prom = new Promise((resolve, reject) => {
            const run = openai.beta.threads.runs.stream(this.thread.id, {
                assistant_id: this.agent.id
              })
                .on('event', (event) => {
                    if (event.event == "thread.message.completed") {
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
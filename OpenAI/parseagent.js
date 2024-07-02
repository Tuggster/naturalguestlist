const OpenAI = require("openai");
const openai = new OpenAI();

const fs = require("fs");
const path = require("path");
let promptPath = path.join(__dirname, "/parse.prompt")
const parsePrompt = fs.readFileSync(promptPath).toString();

class OpenAIParseAgent {
    constructor(id) {
        this.id = id;
    }

    // Contacts the OpenAI API and creates an agent to parse the conversation into a CSV.
    // ARGS:
    // conversationLog -- The conversation log to be converted to CSV.
    // OUTPUT: A promise. Resolved once the results are retrieved from the API.
    // Resolve arguments contain a plaintext version of the CSV results.
    getCSVFromLog(conversationLog) {
        let prom = new Promise(async (resolve, reject) => {

            conversationLog = this.logToReadableFormat(conversationLog);
            console.log(conversationLog);
            console.log(parsePrompt);

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: parsePrompt },
                    { role: "user", content:conversationLog }
                ],
                model: "gpt-3.5-turbo",
            });

            console.log(completion.choices[0]);
            resolve(completion.choices[0])
        })

        return prom;
    }

    // Converts the conversation log to a plaintext format suitable for the parsing agent.
    // ARGS:
    // conversationLog -- Takes a session conversation log
    // OUTPUT:
    // Returns a string, containing a formatted version of the input log.
    logToReadableFormat(conversationLog) {
        let content = "";
        conversationLog.forEach(element => {
            content += `\nSender: ${element.role}`
            content += `\n Message: ${element.content}`
        });
        return content;
    }
}

module.exports = {
    OpenAIParseAgent
}
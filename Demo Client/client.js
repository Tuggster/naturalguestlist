class gQLClient {
    static serverAddress = "http://localhost:4000/graphql";

    // Make a GraphQL request to serverAddress
    // ARGS:
    // query -- The GraphQL Query to make, in plain text.
    // args -- A JavaScript Object containing all the variables to be sent for substitution.
    // OUTPUT:
    // Returns a promise, fulfilled on response from the server.
    // Resolved on success, and rejected on error.
    static makeRequest(query, args) {
        let prom = new Promise((resolve, reject) => {
            fetch(this.serverAddress, {
                method: "POST",
                mode: "cors",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({ query, variables: args }),
              })
                .then(r => r.json())
                .then(data => {
                    console.log("data returned:", data);
                    if (data.errors) {
                        reject(data.errors);
                    } else {
                        resolve(data.data);
                    }
                }).catch(err => {
                    console.error(err);
                    reject(err);
                })
        });

        return prom;
    }


    // Creates a session.
    // OUTPUT:
    // Returns a promise, fulfilled with the session id, state, and conversation log on success.
    static createSession() {
        let query = `
        mutation {
            createSession(name: "demo session") {
                id,
                state,
                conversationLog {
                    role,
                    content,
                    index
                }
            }
        }`

        return this.makeRequest(query);
    }

    static getSession(id) {
        let query = `
        query ($id: String){
            getSession(id: $id) {
                id,
                state,
                result,
                conversationLog {
                    role,
                    content,
                    index
                }
            }
        }`


        return this.makeRequest(query, { id });
    }

    static sendMessage(id, content) {
        let query = `
        mutation ($id: String, $request: String){
            appendThread(id: $id, request: $request) {
                state,
                result,
                conversationLog {
                    role,
                    content,
                    index
                }
            }
        }`

        return this.makeRequest(query, { id, request: content });
    }

    static getLog() {

    }
}

currentSession = undefined;

class SessionManager {
    constructor(name) {
        this.conversationLog = undefined;
        this.id = undefined;
        this.state = "init";
        this.results = undefined;
        gQLClient.createSession().then(res => {
            console.log(res.createSession.id)
            this.id = res.createSession.id;
            this.conversationLog = res.createSession.conversationLog;
            DisplayManager.addNewMessages(this.conversationLog);
            this.state = "guiding";
        })
    }

    sendMessage(content) {
        DisplayManager.addMessage({
            role: "user",
            content,
            index: DisplayManager.getMessageCount() + 1
        })
        gQLClient.sendMessage(this.id, content).then(res => {
            let session = res.appendThread;
            this.conversationLog = session.conversationLog;

            // Remove EOC flag, print out results.
            if (session.state == "done") {
                let lastIndex = this.conversationLog.length - 1;
                let lastMessage = this.conversationLog[lastIndex].content;
                let eocIndex = lastMessage.indexOf("[END OF CONVERSATION]");
                this.conversationLog[lastIndex].content = lastMessage.slice(0, eocIndex);
                this.state = "done";
                this.results = session.result;
                let fileURL = this.saveOutputToCSV();
                DisplayManager.addNewMessages(this.conversationLog);
                DisplayManager.addDownloadLink(fileURL);
            } else {
                DisplayManager.addNewMessages(this.conversationLog);
            }

        });
    }

    getSession() {
        return gQLClient.getSession(this.id);
    }

    refreshLog() {
        console.log(this.id);
        this.getSession().then(session => {
            this.conversationLog = session.getSession.conversationLog;
            DisplayManager.addNewMessages(this.conversationLog)
        })
    }

    saveOutputToCSV() {
        if (this.state == "done" && this.results) {
            let data = new Blob([this.results], {type: 'text/plain'});
            let textFile = window.URL.createObjectURL(data);
            console.log(textFile);
            return textFile;
        } else {
            return null;
        }
    }
}


window.addEventListener("load", event => {
    DisplayManager.messageTemplate = document.getElementById("message-template");
    DisplayManager.downloadTemplate = document.getElementById("download-template");
    DisplayManager.messageContainer = document.querySelector(".convo-history");

    let sendButton = document.getElementById("send");
    let textbox = document.getElementById("textbox");

    sendButton.addEventListener("click", event => {
        if (currentSession) {
            currentSession.sendMessage(textbox.value);
            textbox.value = "";
        }
    })
})

class DisplayManager {
    static messageTemplate;
    static downloadTemplate;
    static messageContainer;
    static messages = new Array();

    static clearMessages() {
        this.messageContainer.innerHTML = "";
        this.messages = new Array();
    }

    static getMessageCount() {
        return this.messages.length;
    }

    static addNewMessages(conversationLog) {
        conversationLog.forEach(message => {
            console.log(message.index, this.messages.length)
            if (message.index != undefined) {
                if (message.index <= this.messages.length) {
                    return;
                }
            }

            this.addMessage(message);
        });
    }

    static addMessage(message) {
        console.log(message, this.messages);
        this.messages.push(message);

        let content = message.content;
        let role = message.role;

        let template = this.messageTemplate.content.cloneNode(true);
        let outer = template.querySelector("#outer");
        let inner = template.querySelector("p");

        outer.classList.add(role.toLowerCase());
        inner.innerHTML = content.toString();

        console.log(template, outer, inner);

        this.messageContainer.appendChild(template);
    }

    static addDownloadLink(downloadURL) {
        let template = this.downloadTemplate.content.cloneNode(true);
        let button = template.querySelector("button");
        let url = template.querySelector("h3");

        button.addEventListener("click", event => {
            window.open(downloadURL, '_blank').focus();
        })

        url.innerHTML = downloadURL.toString();
        this.messageContainer.appendChild(template);
    }
}
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

    // Get a session from the server.
    // ARGS:
    // id -- The ID of the session to fetch.
    // OUTPUT:
    // Returns a promise resolved on successful fetching of the session.
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

    // Sends a message to the Guide Agent and returns the new state of the session.
    // ARGS:
    // ID -- The ID of the session to send a message to.
    // Content -- The content of the message to send to the Guide Agent.
    // OUTPUT:
    // Returns a promise that resolves to the new state of the session.
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
}

currentSession = undefined;


// Instances of the SessionManager class track the state of a Session.
class SessionManager {

    // Construct a new SessionManager
    // ARGS:
    // name -- Friendly name for the session to be stored on the server.
    // OUTPUT:
    // Creates a SessionManger.
    // Registers a session with the server, initializes the agents,
    // and updates the UI with the initial state of the session.
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

    // Sends a message to the Guide Agent for this session.
    // ARGS:
    // content -- The message to send.
    // OUTPUT:
    // Adds the user message and the Guide response to the UI.
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

    // Gets the current state of this session.
    // OUTPUT:
    // Returns a promise resolved on successful fetching of the session.
    getSession() {
        return gQLClient.getSession(this.id);
    }

    // Pulls down the current state of the chatlog.
    // OUTPUT:
    // No returns.
    // Updates the UI to reflect the current chatlog.
    refreshLog() {
        console.log(this.id);
        this.getSession().then(session => {
            this.conversationLog = session.getSession.conversationLog;
            DisplayManager.addNewMessages(this.conversationLog)
        })
    }

    // Saves the Parsing Agent results to a CSV file.
    // OUTPUT:
    // Returns the URL to a Blob containing the data.
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


// Page load setup
// Loads some refrences to the UI
// Sets up event listeners
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

// Static class that manages the UI Elements
class DisplayManager {
    static messageTemplate;
    static downloadTemplate;
    static messageContainer;
    static messages = new Array();

    // Clears the chatlog
    // OUTPUT:
    // Message container UI element wiped
    // Stored messages deleted
    static clearMessages() {
        this.messageContainer.innerHTML = "";
        this.messages = new Array();
    }

    // Getter for mesages.length
    static getMessageCount() {
        return this.messages.length;
    }

    // Adds all NEW messages to the UI.
    // ARGS:
    // conversationLog -- The latest conversation log from a session.
    // OUTPUT:
    // Takes all messages that are not currently on the UI,
    // Displays them and adds them to the messages array.
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

    // Adds a singular message to the UI.
    // ARGS:
    // message -- The message object to be added.
    // OUTPUT:
    // Adds a message to the UI on the appropriate side.
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

    // Adds a download link to the UI.
    // ARGS:
    // downloadURL -- The link to the file the button should download
    // OUTPUT:
    // Adds a download URL and button to the UI.
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
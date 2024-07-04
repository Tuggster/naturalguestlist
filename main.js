// Express + GraphQL
var express = require("express")
var { createHandler } = require("graphql-http/lib/use/express")
var { buildSchema } = require("graphql")
var cors = require('cors')

// GraphiQL via ruru
var { ruruHTML } = require("ruru/server")

const path = require("path")
const fs = require("fs");

if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
}


// Pull schema in from schema.gql
let schemaFolder = path.join(__dirname, "./GraphQL/Schema");
let schemaName = "schema.gql";
let schemaFile = fs.readFileSync(`${schemaFolder}/${schemaName}`);
var schema = buildSchema(schemaFile.toString());

// Import our resolver.
const resolver = require("./GraphQL/Routing/queryroot.js")

// The root provides a resolver function for each API endpoint
var root = resolver.root;

var app = express()
app.use(cors())

// Create and use the GraphQL handler.
app.all(
  "/graphql",
  createHandler({
    schema: schema,
    rootValue: root,
  })
)

// Start the server at port
app.listen(4000)
console.log("Running a GraphQL API server at http://localhost:4000/graphql")


// GraphiQL IDE
app.get("/", (_req, res) => {
    res.type("html")
    res.end(ruruHTML({ endpoint: "/graphql" }))
  })

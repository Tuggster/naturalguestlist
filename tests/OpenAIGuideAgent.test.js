var chai = require('chai');
const expect = chai.expect;

const { OpenAIGuideAgent } = require("../OpenAI/guideagent");


describe('#initAgent', function() {
    let guide;
    before("Prepare the agent", async () => {
        guide = new OpenAIGuideAgent("test");
        return guide.initAgent();
    });


    it("should be defined", function() {
        expect(guide.agent).to.not.be.undefined;
    })

    it("should have an id", function() {
        expect(guide.agent.id).to.not.be.undefined;
    })

    it("should be the right model", function() {
        expect(guide.agent.model).to.equal("gpt-3.5-turbo");
    })
})

describe('#appendThread', function() {
    this.timeout(15000);

    let guide;
    let result;
    beforeEach("Prepare the agent", async () => {
        guide = new OpenAIGuideAgent("test");
        return guide.initAgent();
    });

    this.afterEach("Kill the agent", () => {
        guide.cleanup();
    })

    context("with valid message", async function() {
        it("should return a valid message.", async function() {
            await guide.appendThread("james phillips, jp@example.com")
            result = await guide.runThread();

            expect(result).to.not.be.undefined;
        })
    });

    context("with invalid message", function() {
        it("should throw an error", async function(done) {
            try {
                await guide.appendThread("")
                await guide.runThread();
                done()
            } catch (err) {
                expect(err.toString()).to.equal("Error: Zero length messages not allowed.");
                done();
            }
        })
    });

    context("with invalid guide state", function() {
        it("should throw an error", async function(done) {
            try {
                // guide.agent.initialized = false;
                guide = new OpenAIGuideAgent("test");
                await guide.appendThread("");
                let res = await guide.runThread();
                done();
            } catch (err) {
                expect(err.toString()).to.equal("Error: Agent not initialized.");
                done();
            }
        })
    });
})

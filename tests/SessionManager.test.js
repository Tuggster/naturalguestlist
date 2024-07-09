var chai = require('chai');
const expect = chai.expect;

const root = require('../GraphQL/Routing/queryroot.js').root;
const { SessionManager } = require("../Storage/usersessions.js");

let sessions = new SessionManager();
let session = undefined;

describe('#createSession', function() {
    this.timeout(15000);

    this.beforeEach("Prep Session", (done) => {
        root.createSession({ name: "test" }).then(res => {
            session = res;
            done();
        });
    })

    this.afterEach("Kill Sessions", () => {
        session.cleanup();
    })

    context('With Valid Name', function() {
        it('should return a valid session', function(done) {
            expect(session.name).to.equal("test");
            expect(session.id).to.not.be.undefined;
            done();
        })
    });
})

describe('#getSession', function() {
    this.timeout(15000);

    this.beforeAll("Prep Session", (done) => {
        root.createSession({ name: "test" }).then(res => {
            session = res;
            done();
        });
    })

    this.afterAll("Kill Sessions", () => {
        session.cleanup();
    })


    context('With Valid Name', function() {
        it('should be registered in the SessionManager', function() {
            let getSession = root.getSession({ id: session.id });
            expect(getSession.name).to.equal(session.name);
            expect(getSession.id).to.equal(session.id);
        })
    });

    context('With Inalid Name', function() {
        it('should throw an error', function() {
            expect(() => {
                root.getSession({ id: "invalid id" })
            }).to.throw("No matching session found.");
        })
    });
})
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
    try {
        const mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        console.log(`[MemoryServer] Started at ${uri}`);
        
        process.env.MONGODB_URI = uri;
        process.env.NODE_ENV = 'test';
        process.env.TS_NODE_PREFER_TS_EXTS = 'true';

        require('ts-node/register/transpile-only');
        
        // Now start the server
        require('../../src/server.ts');
    } catch (err) {
        console.error("Failed to start mockup server", err);
    }
})();

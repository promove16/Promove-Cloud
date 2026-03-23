const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
    try {
        const mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        console.log(`[MemoryServer] Started at ${uri}`);
        
        process.env.MONGODB_URI = uri;
        process.env.NODE_ENV = 'test';
        
        // Now start the server
        require('./src/server.js');
    } catch (err) {
        console.error("Failed to start mockup server", err);
    }
})();

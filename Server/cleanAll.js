const mongoose = require('mongoose');
require('dotenv').config();

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');
  
  const email = 'tech@promovecyc.com';
  
  // Clean Users
  const userRes = await mongoose.connection.collection('users').deleteMany({ email });
  console.log('Deleted Users:', userRes.deletedCount);
  
  // Clean StudentProfiles
  const studentProfileRes = await mongoose.connection.collection('studentprofiles').deleteMany({ email });
  console.log('Deleted StudentProfiles (email):', studentProfileRes.deletedCount);
  const studentProfileRes2 = await mongoose.connection.collection('studentprofiles').deleteMany({ userEmail: email });
  console.log('Deleted StudentProfiles (userEmail):', studentProfileRes2.deletedCount);
  
  // Clean from School rosters
  const School = mongoose.connection.collection('schoolprofiles');
  const schoolRes1 = await School.updateMany({}, { $pull: { roster: { email } } });
  const schoolRes2 = await School.updateMany({}, { $pull: { students: { email } } });
  console.log('School pull roster/students:', schoolRes1.modifiedCount, schoolRes2.modifiedCount);

  // Clean from College rosters
  const College = mongoose.connection.collection('collegeprofiles');
  const colRes1 = await College.updateMany({}, { $pull: { roster: { email } } });
  const colRes2 = await College.updateMany({}, { $pull: { students: { email } } });
  console.log('College pull roster/students:', colRes1.modifiedCount, colRes2.modifiedCount);

  // Clean action tokens
  const ActionToken = mongoose.connection.collection('actiontokens');
  const tokenRes = await ActionToken.deleteMany({ email });
  console.log('Deleted Action Tokens:', tokenRes.deletedCount);

  process.exit(0);
}

clean().catch(console.error);

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const ROLES = require('./src/constants/roles');
const bcrypt = require('bcryptjs');

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash('Password123!', parseInt(process.env.BCRYPT_ROUNDS) || 12);

    for (const roleKey of Object.keys(ROLES)) {
      const role = ROLES[roleKey];
      const email = `${role}@test.com`;

      await User.deleteOne({ email });

      const ProfileModel = require('./src/modules/auth/auth.service').PROFILE_MODEL_MAP[role];
      const user = new User({
        name: `Test ${role}`,
        email,
        password: passwordHash,
        role,
        isVerified: true,
        isActive: true,
      });

      // skip hashing pre-save since it's already hashed manually or we just let pre-save do it.
      // Wait, User.js has a pre-save hook for password!
      // So I should pass the plain password and let the hook hash it!
      const user2 = new User({
        name: `Test ${role}`,
        email,
        password: 'Password123!',
        role,
        isVerified: true,
        isActive: true,
      });
      await user2.save();

      if (ProfileModel) {
        await ProfileModel.create({ userId: user2._id });
      }

      console.log(`Created user for role: ${role} (${email})`);
    }

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedUsers();

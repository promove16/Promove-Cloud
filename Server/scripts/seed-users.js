process.env.TS_NODE_PREFER_TS_EXTS = 'true';
require('ts-node/register/transpile-only');
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../src/modules/user/user.model');
const { UserRole } = require('../src/types/roles.types');

const DEFAULT_PASSWORD = 'Password123!';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const SEED_USERS = [
  {
    role: UserRole.STUDENT,
    email: 'student@test.com',
    displayName: 'Test Student',
    accessGrantedBy: 'startup_school',
  },
  {
    role: UserRole.SCHOOL,
    email: 'school@test.com',
    displayName: 'Test School',
    accessGrantedBy: 'startup_school',
  },
  {
    role: UserRole.COLLEGE,
    email: 'college@test.com',
    displayName: 'Test College',
    accessGrantedBy: 'iii',
  },
  {
    role: UserRole.MENTOR,
    email: 'mentor@test.com',
    displayName: 'Test Mentor',
    accessGrantedBy: 'skill_dev',
  },
  {
    role: UserRole.INVESTOR,
    email: 'investor@test.com',
    displayName: 'Test Investor',
    accessGrantedBy: 'instant_internship',
  },
  {
    role: UserRole.RECRUITER,
    email: 'recruiter@test.com',
    displayName: 'Test Recruiter',
    accessGrantedBy: 'instant_internship',
  },
  {
    role: UserRole.ADMIN,
    email: 'admin@test.com',
    displayName: 'Test Admin',
    accessGrantedBy: 'admin',
  },
];

const seedUsers = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from .env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

    for (const seedUser of SEED_USERS) {
      const payload = {
        email: seedUser.email,
        passwordHash,
        role: seedUser.role,
        displayName: seedUser.displayName,
        profileComplete: false,
        innovationScore: 0,
        scoreBreakdown: {
          problemsClaimed: 0,
          skillsCompleted: 0,
          progressUploads: 0,
          patentsSubmitted: 0,
          patentsApproved: 0,
          mvpsVerified: 0,
          marketReadyVerified: 0,
          startupsLaunched: 0,
          awardsApproved: 0,
        },
        accessGrantedBy: seedUser.accessGrantedBy,
        accessExpiresAt: new Date(Date.now() + ONE_YEAR_MS),
        isActive: true,
      };

      await User.findOneAndUpdate({ email: seedUser.email }, payload, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      console.log(`Seeded ${seedUser.role}: ${seedUser.email}`);
    }

    console.log(`Seed completed successfully. Password for all users: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    console.error('Seed error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void seedUsers();

import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { logError, logger } from '../config/logger';
import { User } from '../modules/user/user.model';

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const run = async () => {
  const email = (getArgValue('email') ?? process.env.RESET_USER_EMAIL ?? '').trim().toLowerCase();
  const password = getArgValue('password') ?? process.env.RESET_USER_PASSWORD ?? '';

  if (!email) {
    throw new Error('Missing email. Use --email=user@example.com or RESET_USER_EMAIL.');
  }

  if (!password || password.length < 8 || password.length > 72) {
    throw new Error('New password must be 8-72 characters. Use --password=... or RESET_USER_PASSWORD.');
  }

  await connectDB();

  const user = await User.findOne({ email }).select('_id email role isActive adminApprovalStatus verificationStatus');

  if (!user) {
    throw new Error(`No user found for email ${email}.`);
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  await User.collection.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        mustChangePasswordOnNextLogin: false,
      },
      $unset: {
        password: '',
      },
    },
  );

  logger.info('User password reset completed', {
    userId: String(user._id),
    role: user.role,
    isActive: user.isActive,
    adminApprovalStatus: user.adminApprovalStatus,
    verificationStatus: user.verificationStatus,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        role: user.role,
        isActive: user.isActive,
        adminApprovalStatus: user.adminApprovalStatus,
        verificationStatus: user.verificationStatus,
      },
      null,
      2,
    ),
  );
};

void run()
  .catch((error) => {
    logError('Reset user password failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });

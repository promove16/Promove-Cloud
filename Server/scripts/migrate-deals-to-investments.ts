import mongoose, { Schema } from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db';
import { Startup } from '../src/modules/startup/startup.model';
import { Investment } from '../src/modules/deal/investment.model';

type LegacyDeal = {
  _id: mongoose.Types.ObjectId;
  investorId: mongoose.Types.ObjectId;
  startupId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  stage?: 1 | 2 | 3 | 4;
  amountINR?: number;
  fundTransferInitiatedAt?: Date;
  equityPercent?: number;
  adminApprovalRequired?: boolean;
  adminApprovedAt?: Date;
  adminApprovedBy?: mongoose.Types.ObjectId;
  closedAt?: Date;
  innovationScoreSnapshot?: number;
  status?: 'active' | 'closed' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
};

const legacyDealSchema = new Schema<LegacyDeal>(
  {
    investorId: Schema.Types.ObjectId,
    startupId: Schema.Types.ObjectId,
    studentId: Schema.Types.ObjectId,
    stage: Number,
    amountINR: Number,
    fundTransferInitiatedAt: Date,
    equityPercent: Number,
    adminApprovalRequired: Boolean,
    adminApprovedAt: Date,
    adminApprovedBy: Schema.Types.ObjectId,
    closedAt: Date,
    innovationScoreSnapshot: Number,
    status: String,
  },
  { timestamps: true, strict: false, collection: 'deals' },
);

const LegacyDealModel =
  mongoose.models.LegacyDeal || mongoose.model<LegacyDeal>('LegacyDeal', legacyDealSchema, 'deals');

const run = async () => {
  await connectDB();

  const deals = await LegacyDealModel.find({}).lean<LegacyDeal[]>();
  let migrated = 0;

  for (const deal of deals) {
    const startup = await Startup.findById(deal.startupId)
      .select('_id totalShares')
      .lean<{ _id: mongoose.Types.ObjectId; totalShares: number } | null>();

    if (!startup) {
      console.warn(`Skipping legacy deal ${deal._id}: startup missing.`);
      continue;
    }

    const exists = await Investment.findOne({
      startupId: deal.startupId,
      investorId: deal.investorId,
    }).lean();

    if (exists) {
      continue;
    }

    const equityPercent = deal.equityPercent ?? 0;
    const sharesAllocated = Math.floor((equityPercent / 100) * startup.totalShares);

    await Investment.create({
      startupId: deal.startupId,
      investorId: deal.investorId,
      studentId: deal.studentId,
      investorType: 'sole',
      amountINR: deal.amountINR ?? 20000,
      proposedAmountINR: deal.amountINR ?? 20000,
      equityPercent,
      proposedEquityPercent: equityPercent,
      sharesAllocated,
      investorRole: 'shareholder',
      votingWeight: 0,
      canVeto: false,
      canAccessFinancials: false,
      canRequestUpdates: true,
      stage: deal.stage ?? 1,
      fundTransferInitiatedAt: deal.fundTransferInitiatedAt,
      adminApprovalRequired: deal.adminApprovalRequired ?? false,
      adminApprovedAt: deal.adminApprovedAt,
      adminApprovedBy: deal.adminApprovedBy,
      closedAt: deal.closedAt,
      innovationScoreSnapshot: deal.innovationScoreSnapshot ?? 0,
      status: deal.status ?? 'active',
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    });

    migrated += 1;
  }

  console.log(`Migration complete. ${migrated} legacy deals copied into investments.`);
};

run()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });

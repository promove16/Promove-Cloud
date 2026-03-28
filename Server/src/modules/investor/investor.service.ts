import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import {
  DealDetailView,
  DealGroupView,
  DealTransitionResponse,
  InvestorAuthorityView,
} from '../deal/deal.types';
import {
  advanceDealStage,
  createInvestorDealFromInterest,
  ExpressInterestSchema,
  getInvestorAuthorityPortfolio,
  getInvestorDashboardStats,
  getInvestorPortfolio,
  getInvestorStartup,
  listDealsForInvestor,
  listInvestorInstitutions,
  listInvestorStartups,
  transitionBodySchema,
} from '../deal/deal.service';
import {
  InvestorDashboardStats,
  InvestorInstitutionCard,
  InvestorPortfolioResponse,
  InvestorStartupDetailResponse,
  InvestorStartupListResponse,
} from './investor.types';

export const getDashboard = async (userId: string): Promise<InvestorDashboardStats> =>
  getInvestorDashboardStats(userId);

export const getStartups = async (
  userId: string,
  filters: {
    minScore?: number;
    maxScore?: number;
    category?: string;
    stage?: string;
    page?: number;
    limit?: number;
    acceptingPenny?: boolean;
    acceptingSole?: boolean;
  },
): Promise<InvestorStartupListResponse> => listInvestorStartups(userId, filters);

export const getStartup = async (userId: string, startupId: string): Promise<InvestorStartupDetailResponse> =>
  getInvestorStartup(userId, startupId) as Promise<InvestorStartupDetailResponse>;

export const expressInterestSchema = ExpressInterestSchema;

export const expressInterest = async (
  userId: string,
  startupId: string,
  payload: Parameters<typeof createInvestorDealFromInterest>[2],
): Promise<DealDetailView> => createInvestorDealFromInterest(userId, startupId, payload);

export const investAsSole = async (
  userId: string,
  startupId: string,
  payload: Parameters<typeof createInvestorDealFromInterest>[2],
): Promise<DealDetailView> =>
  createInvestorDealFromInterest(userId, startupId, { ...payload, investorType: 'sole' });

export const getDeals = async (userId: string): Promise<DealGroupView[]> => listDealsForInvestor(userId);

export const getInstitutions = async (userId: string, type: 'school' | 'college'): Promise<InvestorInstitutionCard[]> => {
  const investor = await User.findById(userId).select('_id role isActive').lean();

  if (!investor || investor.role !== UserRole.INVESTOR || !investor.isActive) {
    throw new ApiError(403, 'FORBIDDEN', 'Only active investors can access this resource');
  }

  return listInvestorInstitutions(type) as Promise<InvestorInstitutionCard[]>;
};

export const getPortfolio = async (userId: string): Promise<InvestorPortfolioResponse> =>
  getInvestorPortfolio(userId) as Promise<InvestorPortfolioResponse>;

export const getInvestorAuthority = async (userId: string): Promise<InvestorAuthorityView[]> =>
  getInvestorAuthorityPortfolio(userId);

export const updateDealStage = async (
  userId: string,
  dealId: string,
  payload: Parameters<typeof advanceDealStage>[2],
): Promise<DealTransitionResponse> => advanceDealStage(userId, dealId, payload);

export const investorDealTransitionSchema = transitionBodySchema;

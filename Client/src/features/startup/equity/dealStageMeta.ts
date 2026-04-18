import {
  CheckCircle2,
  Clock,
  CreditCard,
  Handshake,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { DealStage } from '../../../types/deal.types';

export interface DealStageInfo {
  stage: DealStage;
  shortLabel: string;
  pipelineLabel: string;
  description: string;
  badgeClassName: string;
  fillClassName: string;
  textClassName: string;
  icon: LucideIcon;
}

export const DEAL_STAGE_META: Record<DealStage, DealStageInfo> = {
  0: {
    stage: 0,
    shortLabel: 'Negotiation',
    pipelineLabel: 'Negotiation',
    description: 'Aligning on amount and equity with the investor.',
    badgeClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    fillClassName: 'bg-amber-500/70',
    textClassName: 'text-amber-300',
    icon: Handshake,
  },
  1: {
    stage: 1,
    shortLabel: 'Diligence',
    pipelineLabel: 'Due Diligence',
    description: 'Reviewing investor profile and accepting or declining the proposal.',
    badgeClassName: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    fillClassName: 'bg-orange-500/70',
    textClassName: 'text-orange-300',
    icon: Clock,
  },
  2: {
    stage: 2,
    shortLabel: 'Payment',
    pipelineLabel: 'Payment Pending',
    description: 'Investor is transferring funds and linking the product workshop.',
    badgeClassName: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    fillClassName: 'bg-blue-500/70',
    textClassName: 'text-blue-300',
    icon: CreditCard,
  },
  3: {
    stage: 3,
    shortLabel: 'Verification',
    pipelineLabel: 'Verification',
    description: 'Awaiting admin verification of the equity transfer.',
    badgeClassName: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    fillClassName: 'bg-purple-500/70',
    textClassName: 'text-purple-300',
    icon: ShieldCheck,
  },
  4: {
    stage: 4,
    shortLabel: 'Closed',
    pipelineLabel: 'Closed',
    description: 'Equity allocated. The investor now appears on the cap table.',
    badgeClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    fillClassName: 'bg-emerald-500/70',
    textClassName: 'text-emerald-300',
    icon: CheckCircle2,
  },
};

export const PIPELINE_ORDER: DealStage[] = [0, 1, 2, 3, 4];

export const isClosedStage = (stage: DealStage) => stage === 4;

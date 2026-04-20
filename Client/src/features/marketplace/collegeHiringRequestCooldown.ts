import type { WorkflowRequest } from "../../types/request.types";

export const COLLEGE_HIRING_REQUEST_COOLDOWN_DAYS = 30;
const COLLEGE_HIRING_REQUEST_COOLDOWN_MS =
  COLLEGE_HIRING_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const cooldownDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export type CollegeHiringRequestCooldownState = {
  latestRequest: WorkflowRequest | null;
  isCoolingDown: boolean;
  nextEligibleAt: string | null;
  buttonLabel: string;
  helperText: string | null;
};

export const isCollegeHiringRequest = (request: WorkflowRequest) =>
  request.type === "college_event_invite" &&
  request.targetEntityType === "recruiter" &&
  request.requestedPermission === "college_hiring_event_request";

export const getLatestCollegeHiringRequest = (
  requests: WorkflowRequest[],
  recruiterId: string,
) =>
  requests
    .filter(
      (request) =>
        isCollegeHiringRequest(request) && request.targetEntityId === recruiterId,
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )[0] ?? null;

export const getCollegeHiringRequestCooldownState = (
  latestRequest: WorkflowRequest | null,
  now = Date.now(),
): CollegeHiringRequestCooldownState => {
  if (!latestRequest) {
    return {
      latestRequest: null,
      isCoolingDown: false,
      nextEligibleAt: null,
      buttonLabel: "Request Hiring Event",
      helperText: null,
    };
  }

  const createdAt = new Date(latestRequest.createdAt).getTime();
  if (Number.isNaN(createdAt)) {
    return {
      latestRequest,
      isCoolingDown: false,
      nextEligibleAt: null,
      buttonLabel: "Request Hiring Event",
      helperText: null,
    };
  }

  const nextEligibleTime = createdAt + COLLEGE_HIRING_REQUEST_COOLDOWN_MS;
  if (nextEligibleTime <= now) {
    return {
      latestRequest,
      isCoolingDown: false,
      nextEligibleAt: new Date(nextEligibleTime).toISOString(),
      buttonLabel: "Request Hiring Event",
      helperText: null,
    };
  }

  const daysRemaining = Math.max(
    1,
    Math.ceil((nextEligibleTime - now) / (24 * 60 * 60 * 1000)),
  );
  const nextEligibleAt = new Date(nextEligibleTime).toISOString();
  const nextEligibleLabel = cooldownDateFormatter.format(
    new Date(nextEligibleTime),
  );

  return {
    latestRequest,
    isCoolingDown: true,
    nextEligibleAt,
    buttonLabel:
      latestRequest.status === "pending"
        ? "Request Pending"
        : `Available in ${daysRemaining}d`,
    helperText: `Next hiring request available on ${nextEligibleLabel}.`,
  };
};

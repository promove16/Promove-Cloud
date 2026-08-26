import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  PortfolioProject,
  PortfolioService,
  PortfolioTestimonial,
  PortfolioBlogPost,
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileSkill,
  UpdateUserProfilePayload,
  UserProfile,
  userApi,
} from "../../api/user.api";
import { toast } from "../../components/ui/sonner";
import { useAuthStore } from "../../store/authStore";

// ─── Section editor identifiers ──────────────────────────────────────────────

export type PortfolioEditorKey =
  | "intro"
  | "about"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "projects"
  | "services"
  | "testimonials"
  | "blog"
  | "institution";

// ─── Theme + base styles (mirrors Portfolio.tsx) ─────────────────────────────

const COLOR = {
  surface: "var(--dashboard-surface-solid)",
  border: "var(--dashboard-border)",
  borderStrong: "var(--dashboard-border-strong)",
  text: "var(--dashboard-text)",
  muted: "var(--dashboard-text-muted)",
  subtle: "var(--dashboard-text-subtle)",
  accent: "var(--dashboard-active-text)",
  accentBg: "var(--dashboard-active-bg)",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2, 6, 23, 0.72)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  zIndex: 1000,
  padding: "48px 16px",
  overflowY: "auto",
};

const dialogStyle: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  background: COLOR.surface,
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: 12,
  boxShadow: "0 24px 72px rgba(2, 6, 23, 0.45)",
  color: COLOR.text,
  display: "flex",
  flexDirection: "column",
};

const dialogHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 24px",
  borderBottom: `1px solid ${COLOR.border}`,
};

const dialogBodyStyle: CSSProperties = {
  padding: "22px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const dialogFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: "16px 24px",
  borderTop: `1px solid ${COLOR.border}`,
  background: "var(--dashboard-surface)",
  borderBottomLeftRadius: 12,
  borderBottomRightRadius: 12,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color: COLOR.subtle,
  marginBottom: 6,
};

const inputBaseStyle: CSSProperties = {
  width: "100%",
  background: "var(--dashboard-surface)",
  color: COLOR.text,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const primaryBtnStyle: CSSProperties = {
  background: COLOR.accent,
  color: "#0b1120",
  border: 0,
  borderRadius: 999,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtnStyle: CSSProperties = {
  background: "transparent",
  color: COLOR.muted,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 999,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostIconBtnStyle: CSSProperties = {
  background: "transparent",
  border: `1px solid ${COLOR.border}`,
  color: COLOR.muted,
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: 10,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "var(--dashboard-surface)",
};

// ─── Small primitive form controls ───────────────────────────────────────────

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  helperText?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        style={inputBaseStyle}
      />
      {props.helperText ? (
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: COLOR.subtle,
            marginTop: 6,
          }}
        >
          {props.helperText}
        </span>
      ) : null}
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 4}
        style={{ ...inputBaseStyle, resize: "vertical", lineHeight: 1.55 }}
      />
    </label>
  );
}

function Select<T extends string>(props: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        style={inputBaseStyle}
      >
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: COLOR.muted,
      }}
    >
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  );
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

function ModalShell(props: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  children: ReactNode;
  submitLabel?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [props]);

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <form
        style={dialogStyle}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <div style={dialogHeaderStyle}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: COLOR.text,
              margin: 0,
            }}
          >
            {props.title}
          </h3>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            style={ghostIconBtnStyle}
          >
            <X size={16} />
          </button>
        </div>
        <div style={dialogBodyStyle}>{props.children}</div>
        <div style={dialogFooterStyle}>
          <button
            type="button"
            onClick={props.onClose}
            style={secondaryBtnStyle}
            disabled={props.isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={primaryBtnStyle}
            disabled={props.isSaving}
          >
            {props.isSaving ? "Saving..." : props.submitLabel ?? "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Public Edit button ──────────────────────────────────────────────────────

export function EditButton({
  onClick,
  label = "Edit section",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: COLOR.accentBg,
        color: COLOR.accent,
        border: `1px solid ${COLOR.borderStrong}`,
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <Pencil size={13} /> Edit
    </button>
  );
}

// ─── Shared save plumbing ────────────────────────────────────────────────────

const readError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message ?? fallback;

function useUpdateProfile(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: (payload: UpdateUserProfilePayload) => userApi.updateMe(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(["profile", "me"], user);
      setUser(user);
      toast.success("Profile updated.");
      onSuccess?.();
    },
    onError: (error) =>
      toast.error(readError(error, "Unable to update your profile right now.")),
  });
}

const newId = () =>
  `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const parseOptionalYear = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ─── Intro editor ────────────────────────────────────────────────────────────

function IntroEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [domain, setDomain] = useState(profile.domain ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");

  const mutation = useUpdateProfile(onClose);

  return (
    <ModalShell
      title="Edit intro"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          displayName: displayName.trim(),
          headline: headline.trim(),
          domain: domain.trim(),
          bio: bio.trim(),
          location: location.trim(),
          websiteUrl: websiteUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
        })
      }
      isSaving={mutation.isPending}
    >
      <Field
        label="Display name"
        value={displayName}
        onChange={setDisplayName}
      />
      <Field
        label="Headline"
        value={headline}
        onChange={setHeadline}
        placeholder="What should people notice first?"
      />
      <Field
        label="Domain / focus"
        value={domain}
        onChange={setDomain}
        placeholder="AI, robotics, full-stack engineering"
      />
      <TextArea label="About" value={bio} onChange={setBio} rows={5} />
      <Field label="Location" value={location} onChange={setLocation} />
      <Field
        label="Website"
        value={websiteUrl}
        onChange={setWebsiteUrl}
        type="url"
      />
      <Field
        label="LinkedIn URL"
        value={linkedinUrl}
        onChange={setLinkedinUrl}
        type="url"
      />
    </ModalShell>
  );
}

// ─── About editor (subset of Intro: bio + headline/domain/location) ──────────

function AboutEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [domain, setDomain] = useState(profile.domain ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [twitterUrl, setTwitterUrl] = useState(profile.twitterUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(profile.youtubeUrl ?? "");
  const [behanceUrl, setBehanceUrl] = useState(profile.behanceUrl ?? "");
  const [dribbbleUrl, setDribbbleUrl] = useState(profile.dribbbleUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(profile.instagramUrl ?? "");
  const [researchGateUrl, setResearchGateUrl] = useState(
    profile.researchGateUrl ?? "",
  );
  const [mediumUrl, setMediumUrl] = useState(profile.mediumUrl ?? "");

  const mutation = useUpdateProfile(onClose);

  return (
    <ModalShell
      title="Edit about"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          bio: bio.trim(),
          domain: domain.trim(),
          headline: headline.trim(),
          location: location.trim(),
          websiteUrl: websiteUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
          twitterUrl: twitterUrl.trim(),
          youtubeUrl: youtubeUrl.trim(),
          behanceUrl: behanceUrl.trim(),
          dribbbleUrl: dribbbleUrl.trim(),
          instagramUrl: instagramUrl.trim(),
          researchGateUrl: researchGateUrl.trim(),
          mediumUrl: mediumUrl.trim(),
        })
      }
      isSaving={mutation.isPending}
    >
      <TextArea label="About" value={bio} onChange={setBio} rows={6} />
      <Field label="Domain" value={domain} onChange={setDomain} />
      <Field label="Headline / role" value={headline} onChange={setHeadline} />
      <Field label="Location" value={location} onChange={setLocation} />
      <div
        style={{
          marginTop: 8,
          paddingTop: 14,
          borderTop: `1px solid ${COLOR.border}`,
        }}
      >
        <p style={{ ...labelStyle, marginBottom: 12, color: COLOR.muted }}>
          Social links
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Website" value={websiteUrl} onChange={setWebsiteUrl} type="url" />
          <Field label="LinkedIn" value={linkedinUrl} onChange={setLinkedinUrl} type="url" />
          <Field label="Twitter / X" value={twitterUrl} onChange={setTwitterUrl} type="url" />
          <Field label="YouTube" value={youtubeUrl} onChange={setYoutubeUrl} type="url" />
          <Field label="Instagram" value={instagramUrl} onChange={setInstagramUrl} type="url" />
          <Field label="Behance" value={behanceUrl} onChange={setBehanceUrl} type="url" />
          <Field label="Dribbble" value={dribbbleUrl} onChange={setDribbbleUrl} type="url" />
          <Field label="ResearchGate" value={researchGateUrl} onChange={setResearchGateUrl} type="url" />
          <Field label="Medium" value={mediumUrl} onChange={setMediumUrl} type="url" />
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Skills editor ───────────────────────────────────────────────────────────

const emptySkill = (): ProfileSkill => ({
  name: "",
  category: "other",
  source: "manual",
  level: "beginner",
  endorsements: 0,
  addedAt: new Date().toISOString(),
});

function SkillsEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [skills, setSkills] = useState<ProfileSkill[]>(() =>
    (profile.skills ?? []).map((s) => ({ ...s })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<ProfileSkill>) =>
    setSkills((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setSkills((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit skills"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          skills: skills.filter((s) => s.name.trim()),
        })
      }
      isSaving={mutation.isPending}
    >
      {skills.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          No skills yet. Add one to get started.
        </p>
      ) : null}
      {skills.map((skill, index) => (
        <div key={`${skill.name}-${index}`} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Skill name"
              value={skill.name}
              onChange={(v) => updateAt(index, { name: v })}
            />
            <Select
              label="Category"
              value={skill.category}
              onChange={(v) =>
                updateAt(index, { category: v as ProfileSkill["category"] })
              }
              options={[
                { value: "programming", label: "Programming" },
                { value: "design", label: "Design" },
                { value: "business", label: "Business" },
                { value: "research", label: "Research" },
                { value: "other", label: "Other" },
              ]}
            />
            <Select
              label="Level"
              value={skill.level}
              onChange={(v) =>
                updateAt(index, { level: v as ProfileSkill["level"] })
              }
              options={[
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
                { value: "expert", label: "Expert" },
              ]}
            />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={() => removeAt(index)}
                style={{ ...secondaryBtnStyle, color: "#f87171" }}
              >
                <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setSkills((current) => [...current, emptySkill()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add skill
      </button>
    </ModalShell>
  );
}

// ─── Experience editor ───────────────────────────────────────────────────────

const emptyExperience = (): ProfileExperience => ({
  _id: newId(),
  title: "",
  company: "",
  type: "internship",
  location: "",
  startDate: new Date().toISOString(),
  endDate: null,
  isCurrent: false,
  description: "",
  skills: [],
  source: "manual",
  linkedinId: null,
});

function ExperienceEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ProfileExperience[]>(() =>
    (profile.experience ?? []).map((e) => ({ ...e })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<ProfileExperience>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit experience"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          experience: items.filter(
            (e) => e.title.trim() && e.company.trim(),
          ),
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          No experience added yet. Add your first role to get started.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Title"
              value={item.title}
              onChange={(v) => updateAt(index, { title: v })}
            />
            <Field
              label="Company"
              value={item.company}
              onChange={(v) => updateAt(index, { company: v })}
            />
            <Select
              label="Type"
              value={item.type}
              onChange={(v) =>
                updateAt(index, { type: v as ProfileExperience["type"] })
              }
              options={[
                { value: "full_time", label: "Full time" },
                { value: "part_time", label: "Part time" },
                { value: "internship", label: "Internship" },
                { value: "freelance", label: "Freelance" },
                { value: "volunteer", label: "Volunteer" },
              ]}
            />
            <Field
              label="Location"
              value={item.location}
              onChange={(v) => updateAt(index, { location: v })}
            />
            <Field
              label="Start date"
              type="date"
              value={toDateInput(item.startDate)}
              onChange={(v) =>
                updateAt(index, {
                  startDate: v ? new Date(v).toISOString() : "",
                })
              }
            />
            <Field
              label="End date"
              type="date"
              value={toDateInput(item.endDate)}
              onChange={(v) =>
                updateAt(index, {
                  endDate: v ? new Date(v).toISOString() : null,
                })
              }
            />
          </div>
          <Checkbox
            label="I currently work here"
            checked={item.isCurrent}
            onChange={(v) =>
              updateAt(index, { isCurrent: v, endDate: v ? null : item.endDate })
            }
          />
          <TextArea
            label="Description"
            value={item.description}
            onChange={(v) => updateAt(index, { description: v })}
            rows={3}
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyExperience()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add experience
      </button>
    </ModalShell>
  );
}

// ─── Education editor ────────────────────────────────────────────────────────

const emptyEducation = (): ProfileEducation => ({
  _id: newId(),
  institution: "",
  degree: "",
  fieldOfStudy: "",
  startYear: undefined,
  endYear: null,
  isCurrent: false,
  grade: "",
  activities: "",
  description: "",
  source: "manual",
});

function EducationEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ProfileEducation[]>(() =>
    (profile.education ?? [])
      .filter((e) => e.source !== "institution")
      .map((e) => ({ ...e })),
  );
  const institutionEdu = (profile.education ?? []).filter(
    (e) => e.source === "institution",
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<ProfileEducation>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit education"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          education: [
            ...institutionEdu,
            ...items.filter((e) => e.institution.trim()),
          ],
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          Add your educational background.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Institution"
              value={item.institution}
              onChange={(v) => updateAt(index, { institution: v })}
            />
            <Field
              label="Degree"
              value={item.degree}
              onChange={(v) => updateAt(index, { degree: v })}
            />
            <Field
              label="Field of study"
              value={item.fieldOfStudy}
              onChange={(v) => updateAt(index, { fieldOfStudy: v })}
            />
            <Field
              label="Grade"
              value={item.grade}
              onChange={(v) => updateAt(index, { grade: v })}
            />
            <Field
              label="Start year"
              type="number"
              value={
                item.startYear !== undefined && item.startYear !== null
                  ? String(item.startYear)
                  : ""
              }
              onChange={(v) =>
                updateAt(index, { startYear: parseOptionalYear(v) ?? undefined })
              }
            />
            <Field
              label="End year"
              type="number"
              value={item.endYear !== null ? String(item.endYear) : ""}
              onChange={(v) => updateAt(index, { endYear: parseOptionalYear(v) })}
            />
          </div>
          <Checkbox
            label="Currently studying"
            checked={item.isCurrent}
            onChange={(v) =>
              updateAt(index, { isCurrent: v, endYear: v ? null : item.endYear })
            }
          />
          <TextArea
            label="Description"
            value={item.description}
            onChange={(v) => updateAt(index, { description: v })}
            rows={3}
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyEducation()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add education
      </button>
    </ModalShell>
  );
}

// ─── Certifications editor ───────────────────────────────────────────────────

const emptyCertification = (): ProfileCertification => ({
  _id: newId(),
  name: "",
  issuingOrganization: "",
  issueDate: null,
  expiryDate: null,
  credentialId: "",
  credentialUrl: "",
  source: "manual",
});

function CertificationsEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ProfileCertification[]>(() =>
    (profile.certifications ?? []).map((c) => ({ ...c })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<ProfileCertification>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit certifications"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          certifications: items.filter(
            (c) => c.name.trim() && c.issuingOrganization.trim(),
          ),
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          Showcase certifications you have earned.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Name"
              value={item.name}
              onChange={(v) => updateAt(index, { name: v })}
            />
            <Field
              label="Issuer"
              value={item.issuingOrganization}
              onChange={(v) => updateAt(index, { issuingOrganization: v })}
            />
            <Field
              label="Issue date"
              type="date"
              value={toDateInput(item.issueDate)}
              onChange={(v) =>
                updateAt(index, { issueDate: v ? new Date(v).toISOString() : null })
              }
            />
            <Field
              label="Expiry date"
              type="date"
              value={toDateInput(item.expiryDate)}
              onChange={(v) =>
                updateAt(index, {
                  expiryDate: v ? new Date(v).toISOString() : null,
                })
              }
            />
            <Field
              label="Credential ID"
              value={item.credentialId}
              onChange={(v) => updateAt(index, { credentialId: v })}
            />
            <Field
              label="Credential URL"
              type="url"
              value={item.credentialUrl}
              onChange={(v) => updateAt(index, { credentialUrl: v })}
            />
          </div>
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyCertification()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add certification
      </button>
    </ModalShell>
  );
}

// ─── Projects editor ─────────────────────────────────────────────────────────

const emptyProject = (): PortfolioProject => ({
  _id: newId(),
  title: "",
  description: "",
  techStack: [],
  repoUrl: null,
  liveUrl: null,
  coverImageUrl: null,
  startDate: null,
  endDate: null,
  isCurrent: false,
  source: "manual",
  githubRepoId: null,
  stars: 0,
  forks: 0,
  languages: [],
});

const fromCsv = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function ProjectsEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PortfolioProject[]>(() =>
    (profile.portfolioProjects ?? []).map((p) => ({ ...p })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<PortfolioProject>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit projects"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          portfolioProjects: items.filter((p) => p.title.trim()),
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          Add the projects you want to showcase.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <Field
            label="Title"
            value={item.title}
            onChange={(v) => updateAt(index, { title: v })}
          />
          <TextArea
            label="Description"
            value={item.description}
            onChange={(v) => updateAt(index, { description: v })}
            rows={3}
          />
          <Field
            label="Tech stack (comma separated)"
            value={item.techStack.join(", ")}
            onChange={(v) => updateAt(index, { techStack: fromCsv(v) })}
          />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Repository URL"
              type="url"
              value={item.repoUrl ?? ""}
              onChange={(v) => updateAt(index, { repoUrl: v || null })}
            />
            <Field
              label="Live URL"
              type="url"
              value={item.liveUrl ?? ""}
              onChange={(v) => updateAt(index, { liveUrl: v || null })}
            />
            <Field
              label="Cover image URL"
              type="url"
              value={item.coverImageUrl ?? ""}
              onChange={(v) => updateAt(index, { coverImageUrl: v || null })}
            />
          </div>
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyProject()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add project
      </button>
    </ModalShell>
  );
}

// ─── Institution profile editor (school / college) ──────────────────────────

const parseOptionalInt = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const fromMultiline = (value: string) =>
  value
    .split(/\r?\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);

function InstitutionProfileEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const ip = profile.institutionProfile;
  const stats = ip?.stats;

  const [institutionName, setInstitutionName] = useState(
    ip?.institutionName ?? profile.displayName ?? "",
  );
  const [organizationType, setOrganizationType] = useState(
    ip?.organizationType ?? "",
  );
  const [foundedYear, setFoundedYear] = useState(
    ip?.foundedYear !== undefined && ip?.foundedYear !== null
      ? String(ip.foundedYear)
      : "",
  );
  const [location, setLocation] = useState(ip?.location ?? "");
  const [academicYear, setAcademicYear] = useState(ip?.academicYear ?? "");
  const [iicStarRating, setIicStarRating] = useState(
    ip?.iicStarRating !== undefined && ip?.iicStarRating !== null
      ? String(ip.iicStarRating)
      : "",
  );
  const [totalStudentsEnrolled, setTotalStudentsEnrolled] = useState(
    ip?.totalStudentsEnrolled !== undefined && ip?.totalStudentsEnrolled !== null
      ? String(ip.totalStudentsEnrolled)
      : "",
  );
  const [alumniCount, setAlumniCount] = useState(
    ip?.alumniCount !== undefined && ip?.alumniCount !== null
      ? String(ip.alumniCount)
      : "",
  );
  const [employeeCount, setEmployeeCount] = useState(
    ip?.employeeCount !== undefined && ip?.employeeCount !== null
      ? String(ip.employeeCount)
      : "",
  );
  const [contactEmail, setContactEmail] = useState(ip?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(ip?.contactPhone ?? "");
  const [specialties, setSpecialties] = useState(
    (ip?.specialties ?? []).join(", "),
  );
  const [locations, setLocations] = useState((ip?.locations ?? []).join(", "));

  const [totalInnovationActivities, setTotalInnovationActivities] = useState(
    stats?.totalInnovationActivities !== undefined
      ? String(stats.totalInnovationActivities)
      : "",
  );
  const [patentsFiled, setPatentsFiled] = useState(
    stats?.patentsFiled !== undefined ? String(stats.patentsFiled) : "",
  );
  const [totalMentoringHours, setTotalMentoringHours] = useState(
    stats?.totalMentoringHours !== undefined
      ? String(stats.totalMentoringHours)
      : "",
  );
  const [startupsLaunched, setStartupsLaunched] = useState(
    stats?.startupsLaunched !== undefined ? String(stats.startupsLaunched) : "",
  );
  const [industryCollaborations, setIndustryCollaborations] = useState(
    stats?.industryCollaborations !== undefined
      ? String(stats.industryCollaborations)
      : "",
  );

  const mutation = useUpdateProfile(onClose);

  return (
    <ModalShell
      title="Edit institution profile"
      onClose={onClose}
      onSubmit={() => {
        const payload: UpdateUserProfilePayload["institutionProfile"] = {
          institutionName: institutionName.trim(),
          location: location.trim(),
          academicYear: academicYear
            .trim()
            .replace(/\b20\d{3,}\b/g, (m) => `20${m.slice(-2)}`),
          organizationType: organizationType.trim(),
          specialties: fromMultiline(specialties),
          locations: fromMultiline(locations),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
        };

        const founded = parseOptionalInt(foundedYear);
        if (founded !== undefined) payload.foundedYear = founded;
        const iic = parseOptionalInt(iicStarRating);
        if (iic !== undefined) payload.iicStarRating = iic;
        const students = parseOptionalInt(totalStudentsEnrolled);
        if (students !== undefined) payload.totalStudentsEnrolled = students;
        const alumni = parseOptionalInt(alumniCount);
        if (alumni !== undefined) payload.alumniCount = alumni;
        const employees = parseOptionalInt(employeeCount);
        if (employees !== undefined) payload.employeeCount = employees;

        const statsPayload: NonNullable<
          UpdateUserProfilePayload["institutionProfile"]
        >["stats"] = {};
        const innov = parseOptionalInt(totalInnovationActivities);
        if (innov !== undefined) statsPayload.totalInnovationActivities = innov;
        const patents = parseOptionalInt(patentsFiled);
        if (patents !== undefined) statsPayload.patentsFiled = patents;
        const mentoring = parseOptionalInt(totalMentoringHours);
        if (mentoring !== undefined) statsPayload.totalMentoringHours = mentoring;
        const startups = parseOptionalInt(startupsLaunched);
        if (startups !== undefined) statsPayload.startupsLaunched = startups;
        const industry = parseOptionalInt(industryCollaborations);
        if (industry !== undefined) statsPayload.industryCollaborations = industry;
        if (Object.keys(statsPayload).length > 0) payload.stats = statsPayload;

        mutation.mutate({ institutionProfile: payload });
      }}
      isSaving={mutation.isPending}
    >
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <Field
          label="Institution name"
          value={institutionName}
          onChange={setInstitutionName}
        />
        <Field
          label="Organization type"
          value={organizationType}
          onChange={setOrganizationType}
          placeholder="Private, Government, Autonomous"
        />
        <Field
          label="Founded year (establishment)"
          type="number"
          value={foundedYear}
          onChange={setFoundedYear}
        />
        <Field
          label="Academic year"
          value={academicYear}
          onChange={setAcademicYear}
          placeholder="2025-26"
        />
        <Field label="Location" value={location} onChange={setLocation} />
        <Field
          label="IIC star rating"
          type="number"
          value={iicStarRating}
          onChange={setIicStarRating}
        />
        <Field
          label="Total students enrolled"
          type="number"
          value={totalStudentsEnrolled}
          onChange={setTotalStudentsEnrolled}
        />
        <Field
          label="Alumni count"
          type="number"
          value={alumniCount}
          onChange={setAlumniCount}
        />
        <Field
          label="Employee count"
          type="number"
          value={employeeCount}
          onChange={setEmployeeCount}
        />
        <Field
          label="Contact email"
          type="email"
          value={contactEmail}
          onChange={setContactEmail}
        />
        <Field
          label="Contact phone"
          value={contactPhone}
          onChange={setContactPhone}
        />
      </div>
      <TextArea
        label="Specialties (comma separated)"
        value={specialties}
        onChange={setSpecialties}
        rows={2}
      />
      <TextArea
        label="Locations / campuses (comma separated)"
        value={locations}
        onChange={setLocations}
        rows={2}
      />
      <div
        style={{
          marginTop: 8,
          paddingTop: 14,
          borderTop: `1px solid ${COLOR.border}`,
        }}
      >
        <p style={{ ...labelStyle, marginBottom: 12, color: COLOR.muted }}>
          Innovation stats
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <Field
            label="Total innovation activities"
            type="number"
            value={totalInnovationActivities}
            onChange={setTotalInnovationActivities}
          />
          <Field
            label="Patents filed"
            type="number"
            value={patentsFiled}
            onChange={setPatentsFiled}
          />
          <Field
            label="Total mentoring hours"
            type="number"
            value={totalMentoringHours}
            onChange={setTotalMentoringHours}
          />
          <Field
            label="Startups launched"
            type="number"
            value={startupsLaunched}
            onChange={setStartupsLaunched}
          />
          <Field
            label="Industry collaborations"
            type="number"
            value={industryCollaborations}
            onChange={setIndustryCollaborations}
          />
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Services editor ─────────────────────────────────────────────────────────

const emptyService = (): PortfolioService => ({
  _id: newId(),
  title: "",
  description: "",
});

function ServicesEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PortfolioService[]>(() =>
    (profile.portfolioServices ?? []).map((s) => ({ ...s })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<PortfolioService>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit services"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          portfolioServices: items.filter((s) => s.title.trim()),
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          Describe the services you offer.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "120px 1fr" }}>
            <Field
              label="Icon"
              value={item.icon ?? ""}
              onChange={(v) => updateAt(index, { icon: v })}
              placeholder="e.g. 01"
            />
            <Field
              label="Title"
              value={item.title}
              onChange={(v) => updateAt(index, { title: v })}
            />
          </div>
          <TextArea
            label="Description"
            value={item.description}
            onChange={(v) => updateAt(index, { description: v })}
            rows={3}
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyService()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add service
      </button>
    </ModalShell>
  );
}

// ─── Public dispatcher ──────────────────────────────────────────────────────

const emptyTestimonial = (): PortfolioTestimonial => ({
  _id: newId(),
  name: "",
  role: "",
  text: "",
});

function TestimonialsEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PortfolioTestimonial[]>(() =>
    (profile.portfolioTestimonials ?? []).map((t) => ({ ...t })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<PortfolioTestimonial>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit testimonials"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          portfolioTestimonials: items.filter(
            (testimonial) => testimonial.name.trim() && testimonial.text.trim(),
          ),
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          Add feedback from collaborators, founders, or teams you have shipped with.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Name"
              value={item.name}
              onChange={(v) => updateAt(index, { name: v })}
            />
            <Field
              label="Role"
              value={item.role}
              onChange={(v) => updateAt(index, { role: v })}
              placeholder="Founder, company"
            />
          </div>
          <TextArea
            label="Feedback"
            value={item.text}
            onChange={(v) => updateAt(index, { text: v })}
            rows={4}
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyTestimonial()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add testimonial
      </button>
    </ModalShell>
  );
}

const emptyBlogPost = (): PortfolioBlogPost => ({
  _id: newId(),
  tag: "",
  title: "",
  excerpt: "",
  tagColor: "#7c3aed",
  url: null,
  publishedAt: null,
});

function BlogPostsEditor({
  profile,
  onClose,
}: {
  profile: UserProfile;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PortfolioBlogPost[]>(() =>
    (profile.portfolioBlogPosts ?? []).map((post) => ({ ...post })),
  );
  const mutation = useUpdateProfile(onClose);

  const updateAt = (index: number, patch: Partial<PortfolioBlogPost>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeAt = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <ModalShell
      title="Edit recent writing"
      onClose={onClose}
      onSubmit={() =>
        mutation.mutate({
          portfolioBlogPosts: items.filter(
            (post) => post.tag.trim() && post.title.trim(),
          ),
        })
      }
      isSaving={mutation.isPending}
    >
      {items.length === 0 ? (
        <p style={{ color: COLOR.subtle, fontSize: 13 }}>
          Add articles, notes, or posts you want to show on your portfolio.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={item._id} style={cardStyle}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Tag"
              value={item.tag}
              onChange={(v) => updateAt(index, { tag: v })}
              placeholder="DEV"
            />
            <Field
              label="Tag color"
              value={item.tagColor}
              onChange={(v) => updateAt(index, { tagColor: v })}
              placeholder="#7c3aed"
            />
            <Field
              label="Title"
              value={item.title}
              onChange={(v) => updateAt(index, { title: v })}
            />
            <Field
              label="Published date"
              type="date"
              value={toDateInput(item.publishedAt)}
              onChange={(v) =>
                updateAt(index, {
                  publishedAt: v ? new Date(v).toISOString() : null,
                })
              }
            />
          </div>
          <TextArea
            label="Excerpt"
            value={item.excerpt}
            onChange={(v) => updateAt(index, { excerpt: v })}
            rows={3}
          />
          <Field
            label="URL"
            type="url"
            value={item.url ?? ""}
            onChange={(v) => updateAt(index, { url: v || null })}
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            style={{ ...secondaryBtnStyle, color: "#f87171", alignSelf: "flex-start" }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} /> Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems((current) => [...current, emptyBlogPost()])}
        style={secondaryBtnStyle}
      >
        <Plus size={14} style={{ marginRight: 6 }} /> Add writing
      </button>
    </ModalShell>
  );
}

export function PortfolioSectionEditorModal({
  editorKey,
  profile,
  onClose,
}: {
  editorKey: PortfolioEditorKey | null;
  profile: UserProfile | null;
  onClose: () => void;
}) {
  if (!editorKey || !profile) return null;
  switch (editorKey) {
    case "intro":
      return <IntroEditor profile={profile} onClose={onClose} />;
    case "about":
      return <AboutEditor profile={profile} onClose={onClose} />;
    case "skills":
      return <SkillsEditor profile={profile} onClose={onClose} />;
    case "experience":
      return <ExperienceEditor profile={profile} onClose={onClose} />;
    case "education":
      return <EducationEditor profile={profile} onClose={onClose} />;
    case "certifications":
      return <CertificationsEditor profile={profile} onClose={onClose} />;
    case "projects":
      return <ProjectsEditor profile={profile} onClose={onClose} />;
    case "services":
      return <ServicesEditor profile={profile} onClose={onClose} />;
    case "testimonials":
      return <TestimonialsEditor profile={profile} onClose={onClose} />;
    case "blog":
      return <BlogPostsEditor profile={profile} onClose={onClose} />;
    case "institution":
      return <InstitutionProfileEditor profile={profile} onClose={onClose} />;
    default:
      return null;
  }
}

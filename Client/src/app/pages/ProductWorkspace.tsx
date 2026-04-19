import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CheckCircle,
  Circle,
  Clock,
  Code2,
  Download,
  Eye,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Image,
  ImagePlus,
  Loader2,
  Paperclip,
  Plus,
  Presentation,
  Rocket,
  Search,
  Send,
  Trash2,
  Upload,
  UserPlus,
  Users2,
  X,
} from "lucide-react";
import type {
  ChatMessage,
  ChatMessageAttachment,
  WorkspaceTask,
  WorkspaceUpload,
  WorkspaceUploadCategory,
  WorkspaceUploadFileType,
} from "../../types/workspace.types";
import { DashboardLayout } from "../components/DashboardLayout";
import { workspaceApi } from "../../api/workspace.api";
import { useWorkspaceChat } from "../../hooks/useWorkspaceChat";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";
import { FileViewerModal } from "../../components/file-viewer/FileViewerModal";
import { ProductWorkspaceManager } from "./ProductWorkspaceManager";

const d = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";

const dt = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Just now";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type ProgressFormState = {
  note: string;
  milestoneRef: string;
  completionPercent: string;
  file: File | null;
};

type ProgressFormErrors = Partial<Record<"note" | "completionPercent", string>>;
type ChatComposerAction = "message" | "task" | "doc" | "progress" | "invite";
type WorkspaceRole = "founder" | "admin" | "member" | "viewer";

interface WorkspacePermissions {
  canInviteMembers: boolean;
  canAssignAnyTask: boolean;
  canAssignToSelf: boolean;
  canManageDocs: boolean;
  canDeleteWorkspace: boolean;
  canManageSettings: boolean;
}

const CHAT_ACTIVITY_PREFIXES = {
  task: "[Task]",
  doc: "[Doc]",
  progress: "[Progress]",
  invite: "[Invite]",
} as const;

const parseWorkspaceActivityMessage = (message?: string) => {
  const normalizedMessage = message?.trim() ?? "";
  if (!normalizedMessage) {
    return null;
  }

  if (normalizedMessage.startsWith(CHAT_ACTIVITY_PREFIXES.task)) {
    return {
      badge: "Task",
      body: normalizedMessage
        .slice(CHAT_ACTIVITY_PREFIXES.task.length)
        .trim(),
    };
  }

  if (normalizedMessage.startsWith(CHAT_ACTIVITY_PREFIXES.doc)) {
    return {
      badge: "Doc",
      body: normalizedMessage
        .slice(CHAT_ACTIVITY_PREFIXES.doc.length)
        .trim(),
    };
  }

  if (normalizedMessage.startsWith(CHAT_ACTIVITY_PREFIXES.progress)) {
    return {
      badge: "Progress",
      body: normalizedMessage
        .slice(CHAT_ACTIVITY_PREFIXES.progress.length)
        .trim(),
    };
  }

  if (normalizedMessage.startsWith(CHAT_ACTIVITY_PREFIXES.invite)) {
    return {
      badge: "Invite",
      body: normalizedMessage
        .slice(CHAT_ACTIVITY_PREFIXES.invite.length)
        .trim(),
    };
  }

  return null;
};

const getTrailingMentionQuery = (value: string) => {
  const match = value.match(/(?:^|\s)@([\w.-]*)$/);
  return match ? match[1] ?? "" : null;
};

const replaceTrailingMention = (value: string, replacement: string) =>
  value.replace(/(?:^|\s)@[\w.-]*$/, (token) => {
    const hasLeadingSpace = /^\s/.test(token);
    return `${hasLeadingSpace ? " " : ""}@${replacement} `;
  });

const getDueStatus = (dueDate?: string) => {
  if (!dueDate) {
    return {
      label: "No due date",
      tone: "text-slate-500",
    };
  }

  const dueTime = new Date(dueDate).getTime();
  if (Number.isNaN(dueTime)) {
    return {
      label: "Due date unavailable",
      tone: "text-slate-500",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueTime - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return {
      label: `Overdue since ${d(dueDate)}`,
      tone: "text-rose-300",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due today",
      tone: "text-amber-300",
    };
  }

  if (diffDays === 1) {
    return {
      label: "Due tomorrow",
      tone: "text-amber-200",
    };
  }

  return {
    label: `Due ${d(dueDate)}`,
    tone: "text-slate-400",
  };
};

const createEmptyProgressForm = (): ProgressFormState => ({
  note: "",
  milestoneRef: "",
  completionPercent: "",
  file: null,
});

const validateProgressForm = (
  progressForm: ProgressFormState,
): ProgressFormErrors => {
  const errors: ProgressFormErrors = {};
  const trimmedNote = progressForm.note.trim();

  if (!trimmedNote) {
    errors.note = "Add a short progress summary before submitting.";
  } else if (trimmedNote.length < 5) {
    errors.note = "Progress notes must be at least 5 characters.";
  }

  if (progressForm.completionPercent.trim()) {
    const completionPercent = Number(progressForm.completionPercent);

    if (
      Number.isNaN(completionPercent) ||
      completionPercent < 0 ||
      completionPercent > 100
    ) {
      errors.completionPercent = "Completion must stay between 0 and 100.";
    }
  }

  return errors;
};

const getChatAttachment = (
  message: ChatMessage,
): ChatMessageAttachment | undefined => {
  if (message.attachment) {
    return message.attachment;
  }

  if (!message.attachmentUrl || !message.attachmentType) {
    return undefined;
  }

  return {
    fileUrl: message.attachmentUrl,
    fileType: message.attachmentType,
    fileName: message.attachmentName ?? "Attachment",
    fileSizeBytes: message.attachmentSizeBytes ?? 0,
    ...(message.attachmentMimeType
      ? { mimeType: message.attachmentMimeType }
      : {}),
  };
};

const getAttachmentIcon = (fileType?: WorkspaceUploadFileType) => {
  switch (fileType) {
    case "image":
      return <Image className="h-5 w-5" />;
    case "pdf":
    case "doc":
      return <FileText className="h-5 w-5" />;
    case "ppt":
      return <Presentation className="h-5 w-5" />;
    case "xls":
      return <FileSpreadsheet className="h-5 w-5" />;
    default:
      return <Paperclip className="h-5 w-5" />;
  }
};

const isInlinePreviewableFileType = (
  fileType?: WorkspaceUploadFileType,
): boolean =>
  fileType === "image" ||
  fileType === "video" ||
  fileType === "audio" ||
  fileType === "pdf";

const openFileInNewTab = (fileUrl?: string) => {
  if (!fileUrl || typeof window === "undefined") {
    return;
  }

  const openedWindow = window.open(fileUrl, "_blank", "noopener,noreferrer");
  if (!openedWindow) {
    window.location.href = fileUrl;
  }
};

type ProductWorkspaceDetailProps = {
  projectIdOverride?: string;
  embedded?: boolean;
};

export function ProductWorkspaceDetail({
  projectIdOverride,
  embedded = false,
}: ProductWorkspaceDetailProps = {}) {
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState("chat");
  const [toast, setToast] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    priority: "Medium" as WorkspaceTask["priority"],
    assignedTo: "",
    dueDate: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "developer" | "designer" | "researcher" | "marketer" | "lead" | "other"
  >("other");
  const [uploadNote, setUploadNote] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<WorkspaceUploadCategory>("other");
  const [repoForm, setRepoForm] = useState({
    repoUrl: "",
    branch: "",
    commitHash: "",
    note: "",
  });
  const [codeForm, setCodeForm] = useState({
    title: "",
    language: "",
    summary: "",
    codeSnippet: "",
  });
  const [chatDraft, setChatDraft] = useState("");
  const [chatAttachment, setChatAttachment] = useState<File | null>(null);
  const [chatComposerAction, setChatComposerAction] =
    useState<ChatComposerAction>("message");
  const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
  const [taskAssigneeDraft, setTaskAssigneeDraft] = useState("");
  const [chatDocFile, setChatDocFile] = useState<File | null>(null);
  const [chatComposerMode, setChatComposerMode] = useState<"text" | "code">(
    "text",
  );
  const [chatCodeSnippet, setChatCodeSnippet] = useState({
    title: "",
    language: "typescript",
    code: "",
  });
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [progressForm, setProgressForm] = useState<ProgressFormState>(
    createEmptyProgressForm,
  );
  const [hasAttemptedProgressSubmit, setHasAttemptedProgressSubmit] =
    useState(false);
  const [showNegotiationPanel, setShowNegotiationPanel] = useState(false);
  const [participantForm, setParticipantForm] = useState({
    email: "",
    message: "",
    proposedRole: "developer" as const,
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedUpload, setSelectedUpload] = useState<WorkspaceUpload | null>(
    null,
  );
  const [quickFindQuery, setQuickFindQuery] = useState("");
  const chatScrollerRef = useRef<HTMLDivElement | null>(null);
  const chatComposerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const docAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const chatDocInputRef = useRef<HTMLInputElement | null>(null);
  const chatProgressInputRef = useRef<HTMLInputElement | null>(null);

  const listQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
  });
  const progressFormErrors = useMemo(
    () => validateProgressForm(progressForm),
    [progressForm],
  );
  const isProgressFormValid = Object.keys(progressFormErrors).length === 0;
  const showProgressValidation = hasAttemptedProgressSubmit;
  const problemBankWorkspaceOptions = useMemo(
    () =>
      (listQuery.data ?? []).filter((item) => Boolean(item.claimedProblemId)),
    [listQuery.data],
  );
  const projectId = projectIdOverride ?? routeProjectId;
  const workspaceId = projectId || selectedWorkspaceId || undefined;
  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getById(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const workspace = workspaceQuery.data;
  const teamMembers = workspace?.teamMembers ?? [];
  const isOwner = workspace?.ownerId === currentUser?._id;
  const isWorkspaceMember = teamMembers.some(
    (member) => member._id === currentUser?._id,
  );
  const isWorkspaceAdmin = false;
  const workspaceRole: WorkspaceRole = !workspace
    ? "viewer"
    : isOwner
      ? "founder"
      : isWorkspaceMember
        ? "member"
        : "viewer";
  const workspacePermissions: WorkspacePermissions = {
    canInviteMembers: workspaceRole === "founder" || isWorkspaceAdmin,
    canAssignAnyTask: workspaceRole === "founder" || isWorkspaceAdmin,
    canAssignToSelf:
      workspaceRole === "founder" ||
      isWorkspaceAdmin ||
      workspaceRole === "member",
    canManageDocs:
      workspaceRole === "founder" ||
      isWorkspaceAdmin ||
      workspaceRole === "member",
    canDeleteWorkspace: workspaceRole === "founder",
    canManageSettings: workspaceRole === "founder" || isWorkspaceAdmin,
  };
  const canManageWorkspace =
    currentUser?.role === "student" && Boolean(workspace);
  const canManageChatAccess = Boolean(isOwner);
  const chat = useWorkspaceChat(workspaceId);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!currentUser?._id) {
      return;
    }

    if (workspacePermissions.canAssignAnyTask) {
      return;
    }

    if (workspacePermissions.canAssignToSelf) {
      setTaskForm((current) => ({
        ...current,
        assignedTo: currentUser._id,
      }));
      setTaskAssigneeDraft((current) =>
        current.trim() ? current : `@${currentUser.displayName}`,
      );
    }
  }, [
    currentUser?._id,
    currentUser?.displayName,
    workspacePermissions.canAssignAnyTask,
    workspacePermissions.canAssignToSelf,
  ]);

  useEffect(() => {
    if (projectId || !listQuery.data) {
      return;
    }

    const hasSelectedWorkspace = problemBankWorkspaceOptions.some(
      (item) => item._id === selectedWorkspaceId,
    );
    if (!hasSelectedWorkspace) {
      setSelectedWorkspaceId(problemBankWorkspaceOptions[0]?._id ?? "");
    }
  }, [
    projectId,
    listQuery.data,
    problemBankWorkspaceOptions,
    selectedWorkspaceId,
  ]);

  const refresh = async () => {
    if (!workspaceId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["score", "me"] }),
    ]);
  };

  const resetProgressForm = () => {
    setProgressForm(createEmptyProgressForm());
    setHasAttemptedProgressSubmit(false);
  };

  const addTask = useMutation({
    mutationFn: () =>
      workspaceApi.addTask(workspaceId!, {
        title: taskForm.title,
        priority: taskForm.priority,
        assignedTo: taskForm.assignedTo || undefined,
        dueDate: taskForm.dueDate
          ? new Date(taskForm.dueDate).toISOString()
          : undefined,
      }),
    onSuccess: async () => {
      setTaskForm({
        title: "",
        priority: "Medium",
        assignedTo: "",
        dueDate: "",
      });
      setTaskAssigneeDraft("");
      setShowTaskForm(false);
      setToast("Task added.");
      await refresh();
    },
  });

  const toggleTask = useMutation({
    mutationFn: (payload: { taskId: string; done: boolean }) =>
      workspaceApi.updateTask(workspaceId!, payload.taskId, {
        done: payload.done,
      }),
    onSuccess: async () => {
      await refresh();
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) =>
      workspaceApi.deleteTask(workspaceId!, taskId),
    onSuccess: async () => {
      setToast("Task removed.");
      await refresh();
    },
  });

  const invite = useMutation({
    mutationFn: () =>
      workspaceApi.invite(workspaceId!, {
        email: inviteEmail,
        message: inviteMessage.trim() || undefined,
        proposedRole: inviteRole,
      }),
    onSuccess: async () => {
      setInviteEmail("");
      setInviteMessage("");
      setInviteRole("other");
      setShowInviteForm(false);
      setToast("Student teammate invite sent.");
      await refresh();
    },
    onError: (error) =>
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Unable to invite member.",
      ),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      workspaceApi.removeMember(workspaceId!, userId),
    onSuccess: async () => {
      setToast("Team member removed.");
      await refresh();
    },
  });
  const deleteUpload = useMutation({
    mutationFn: (uploadId: string) =>
      workspaceApi.removeUpload(workspaceId!, uploadId),
    onSuccess: async () => {
      setToast("Upload removed.");
      await refresh();
    },
  });

  const addRepo = useMutation({
    mutationFn: () =>
      workspaceApi.addRepoSubmission(workspaceId!, {
        repoUrl: repoForm.repoUrl,
        branch: repoForm.branch || undefined,
        commitHash: repoForm.commitHash || undefined,
        note: repoForm.note || undefined,
      }),
    onSuccess: async () => {
      setRepoForm({ repoUrl: "", branch: "", commitHash: "", note: "" });
      setToast("Repository link attached.");
      await refresh();
    },
    onError: (error) =>
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Unable to attach repository.",
      ),
  });

  const deleteRepo = useMutation({
    mutationFn: (repoId: string) =>
      workspaceApi.removeRepoSubmission(workspaceId!, repoId),
    onSuccess: async () => {
      setToast("Repository link removed.");
      await refresh();
    },
  });

  const addCode = useMutation({
    mutationFn: () => workspaceApi.addCodeSubmission(workspaceId!, codeForm),
    onSuccess: async () => {
      setCodeForm({ title: "", language: "", summary: "", codeSnippet: "" });
      setToast("Code snippet saved securely.");
      await refresh();
    },
    onError: (error) =>
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Unable to save code snippet.",
      ),
  });

  const deleteCode = useMutation({
    mutationFn: (codeId: string) =>
      workspaceApi.removeCodeSubmission(workspaceId!, codeId),
    onSuccess: async () => {
      setToast("Code snippet removed.");
      await refresh();
    },
  });

  const addParticipant = useMutation({
    mutationFn: () =>
      workspaceApi.addChatParticipant(workspaceId!, {
        email: participantForm.email,
        role: "investor",
      }),
    onSuccess: async () => {
      setParticipantForm({
        email: "",
        message: "",
        proposedRole: "developer",
      });
      setToast("Investor chat access request sent.");
      await refresh();
    },
    onError: (error) =>
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Unable to add participant.",
      ),
  });

  const removeParticipant = useMutation({
    mutationFn: (userId: string) =>
      workspaceApi.removeChatParticipant(workspaceId!, userId),
    onSuccess: async () => {
      setToast("Chat participant removed.");
      await refresh();
    },
  });

  const progress = useMutation({
    mutationFn: async () => {
      if (progressForm.file) {
        await workspaceApi.upload(
          workspaceId!,
          progressForm.file,
          progressForm.note,
        );
      }
      return workspaceApi.addProgress(workspaceId!, {
        note: progressForm.note,
        milestoneRef: progressForm.milestoneRef || undefined,
        completionPercent: progressForm.completionPercent
          ? Number(progressForm.completionPercent)
          : undefined,
      });
    },
    onSuccess: async () => {
      resetProgressForm();
      setShowProgressModal(false);
      setToast("Progress uploaded! Your Innovation Score is being updated...");
      await refresh();
    },
    onError: (error) =>
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
          "Unable to upload progress right now.",
      ),
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      return setToast("File size must be 10MB or less.");

    try {
      await workspaceApi.upload(
        workspaceId!,
        file,
        uploadNote || undefined,
        uploadCategory,
      );
      setUploadNote("");
      setUploadCategory("other");
      setToast("File uploaded.");
      await refresh();
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Upload failed.",
      );
    }
  };

  const onChatAttachmentFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setToast("Chat attachments must be 10MB or less.");
      return;
    }

    setChatAttachment(file);
  };

  const sendMessage = async () => {
    if (!workspaceId) return;

    const normalizedMessage = chatDraft.trim();

    if (!normalizedMessage && !chatAttachment) {
      return;
    }

    setIsSendingChat(true);
    try {
      let attachmentPayload:
        | {
            attachmentUrl: string;
            attachmentType: WorkspaceUploadFileType;
            attachmentName: string;
            attachmentSizeBytes: number;
            attachmentMimeType?: string;
          }
        | undefined;

      if (chatAttachment) {
        const uploads = await workspaceApi.upload(
          workspaceId,
          chatAttachment,
          "Chat attachment",
        );
        const latest = uploads[uploads.length - 1];
        if (!latest?.fileUrl || !latest?.fileType) {
          throw new Error("Unable to prepare the chat attachment.");
        }

        attachmentPayload = {
          attachmentUrl: latest.fileUrl,
          attachmentType: latest.fileType,
          attachmentName: latest.fileName,
          attachmentSizeBytes: latest.fileSizeBytes,
          ...(latest.mimeType ? { attachmentMimeType: latest.mimeType } : {}),
        };
        await refresh();
      }

      chat.sendMessage({
        workspaceId,
        message: normalizedMessage,
        ...(attachmentPayload ?? {}),
      });
      setChatDraft("");
      setChatAttachment(null);
      setChatComposerMode("text");
      setChatCodeSnippet({
        title: "",
        language: "typescript",
        code: "",
      });
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
          (error instanceof Error
            ? error.message
            : "Unable to send chat attachment."),
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  const sendActivityMessage = (
    prefix: keyof typeof CHAT_ACTIVITY_PREFIXES,
    body: string,
    attachmentPayload?: {
      attachmentUrl: string;
      attachmentType: WorkspaceUploadFileType;
      attachmentName: string;
      attachmentSizeBytes: number;
      attachmentMimeType?: string;
    },
  ) => {
    if (!workspaceId) {
      return;
    }

    chat.sendMessage({
      workspaceId,
      message: `${CHAT_ACTIVITY_PREFIXES[prefix]} ${body}`.trim(),
      ...(attachmentPayload ?? {}),
    });
  };

  const toChatAttachmentPayload = (upload: WorkspaceUpload) => ({
    attachmentUrl: upload.fileUrl,
    attachmentType: upload.fileType,
    attachmentName: upload.fileName,
    attachmentSizeBytes: upload.fileSizeBytes,
    ...(upload.mimeType ? { attachmentMimeType: upload.mimeType } : {}),
  });

  const uploadWorkspaceFile = async (
    file: File,
    note?: string,
    category?: WorkspaceUploadCategory,
  ) => {
    const uploads = await workspaceApi.upload(
      workspaceId!,
      file,
      note || undefined,
      category,
    );
    const latest = uploads[uploads.length - 1];
    if (!latest?.fileUrl || !latest?.fileType) {
      throw new Error("Unable to prepare the uploaded file.");
    }
    await refresh();
    return latest;
  };

  const submitTaskFromChat = async () => {
    if (!workspaceId || !taskForm.title.trim()) {
      return;
    }

    try {
      const assignedMember = mentionableMembers.find(
        (member) => member._id === taskForm.assignedTo,
      );
      await addTask.mutateAsync();
      sendActivityMessage(
        "task",
        `Created "${taskForm.title.trim()}" with ${taskForm.priority.toLowerCase()} priority${
          taskForm.dueDate ? `, due ${d(taskForm.dueDate)}` : ""
        }${assignedMember ? ` and assigned it to @${assignedMember.displayName}.` : "."}`,
      );
      setChatComposerAction("message");
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Unable to create task.",
      );
    }
  };

  const submitDocFromChat = async () => {
    if (!workspaceId || !chatDocFile) {
      return;
    }

    try {
      const latest = await uploadWorkspaceFile(
        chatDocFile,
        uploadNote || undefined,
        uploadCategory,
      );
      sendActivityMessage(
        "doc",
        uploadNote.trim()
          ? uploadNote.trim()
          : `Uploaded ${latest.fileName} in ${uploadCategory.replace(/_/g, " ")}.`,
        toChatAttachmentPayload(latest),
      );
      setChatDocFile(null);
      setUploadNote("");
      setUploadCategory("other");
      setToast("Document shared in chat.");
      setChatComposerAction("message");
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Upload failed.",
      );
    }
  };

  const submitProgressFromChat = async () => {
    if (!workspaceId || !isProgressFormValid) {
      setHasAttemptedProgressSubmit(true);
      setToast(
        Object.values(progressFormErrors)[0] ??
          "Complete the required progress details first.",
      );
      return;
    }

    try {
      let uploadedProgressFile: WorkspaceUpload | null = null;

      if (progressForm.file) {
        uploadedProgressFile = await uploadWorkspaceFile(
          progressForm.file,
          progressForm.note || undefined,
        );
      }

      await workspaceApi.addProgress(workspaceId, {
        note: progressForm.note,
        milestoneRef: progressForm.milestoneRef || undefined,
        completionPercent: progressForm.completionPercent
          ? Number(progressForm.completionPercent)
          : undefined,
      });

      resetProgressForm();
      setToast("Progress uploaded! Your Innovation Score is being updated...");
      await refresh();
      sendActivityMessage(
        "progress",
        `${progressForm.milestoneRef ? `${progressForm.milestoneRef}: ` : ""}${progressForm.note.trim()}${
          progressForm.completionPercent
            ? ` (${progressForm.completionPercent}% complete)`
            : ""
        }`,
        uploadedProgressFile
          ? toChatAttachmentPayload(uploadedProgressFile)
          : undefined,
      );
      setChatComposerAction("message");
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
          "Unable to upload progress right now.",
      );
    }
  };

  const submitInviteFromChat = async () => {
    if (!workspaceId || !inviteEmail.trim()) {
      return;
    }

    try {
      await invite.mutateAsync();
      sendActivityMessage(
        "invite",
        `Invited ${inviteEmail.trim()} as ${inviteRole}.${
          inviteMessage.trim() ? ` Note: ${inviteMessage.trim()}` : ""
        }`,
      );
      setChatComposerAction("message");
    } catch (error) {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Unable to invite member.",
      );
    }
  };

  const insertChatMention = (memberId: string) => {
    const member = mentionableMembers.find((entry) => entry._id === memberId);
    if (!member) {
      return;
    }

    setChatDraft((current) =>
      replaceTrailingMention(current, member.displayName),
    );
  };

  const assignTaskMention = (memberId: string) => {
    const member = mentionableMembers.find((entry) => entry._id === memberId);
    if (!member) {
      return;
    }

    setTaskForm((current) => ({
      ...current,
      assignedTo: member._id,
    }));
    setTaskAssigneeDraft((current) =>
      replaceTrailingMention(current, member.displayName),
    );
  };

  const nextMilestone = useMemo(
    () =>
      workspace?.milestones.find((item) => !item.isCompleted)?.name ??
      "Ready for review",
    [workspace?.milestones],
  );
  const workspaceOptions = problemBankWorkspaceOptions;
  const completedTaskCount = (workspace?.tasks ?? []).filter(
    (task) => task.done,
  ).length;
  const openTaskCount = (workspace?.tasks ?? []).filter(
    (task) => !task.done,
  ).length;
  const evidenceCount =
    (workspace?.uploads ?? []).length +
    (workspace?.repoSubmissions ?? []).length +
    (workspace?.codeSubmissions ?? []).length;
  const recentUpdates = (workspace?.progressUpdates ?? []).slice(-4).reverse();
  const workspaceSourceLabel = workspace?.claimedProblemId
    ? "Problem Bank"
    : "Independent Workspace";
  const pendingInvites = (workspace?.pendingInvites ?? []).filter(
    (invite) => invite.status === "pending",
  );
  const workspacePeople = useMemo(() => {
    const people = new Map<
      string,
      {
        _id: string;
        displayName: string;
        role: string;
        avatar?: string;
        profileSlug?: string;
      }
    >();

    teamMembers.forEach((member) => {
      people.set(member._id, member);
    });
    (workspace?.chatParticipants ?? []).forEach((participant) => {
      people.set(participant.userId, {
        _id: participant.userId,
        displayName: participant.displayName ?? "Participant",
        role: participant.role,
        avatar: participant.avatar ?? undefined,
        profileSlug: participant.profileSlug ?? undefined,
      });
    });

    return people;
  }, [teamMembers, workspace?.chatParticipants]);
  const openTasks = useMemo(
    () => (workspace?.tasks ?? []).filter((task) => !task.done),
    [workspace?.tasks],
  );
  const myOpenTasks = useMemo(
    () =>
      openTasks.filter(
        (task) => task.assignedTo && task.assignedTo === currentUser?._id,
      ),
    [currentUser?._id, openTasks],
  );
  const nextAttentionTask = useMemo(() => {
    if (openTasks.length === 0) {
      return null;
    }

    return [...openTasks].sort((left, right) => {
      const leftTime = left.dueDate
        ? new Date(left.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueDate
        ? new Date(right.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })[0];
  }, [openTasks]);
  const recentWorkspaceUploads = useMemo(
    () =>
      [...(workspace?.uploads ?? [])]
        .sort(
          (left, right) =>
            new Date(right.uploadedAt).getTime() -
            new Date(left.uploadedAt).getTime(),
        )
        .slice(0, 4),
    [workspace?.uploads],
  );
  const latestWorkspaceUpload = recentWorkspaceUploads[0] ?? null;
  const latestProgressUpdate = useMemo(
    () =>
      [...(workspace?.progressUpdates ?? [])].sort(
        (left, right) =>
          new Date(right.submittedAt).getTime() -
          new Date(left.submittedAt).getTime(),
      )[0] ?? null,
    [workspace?.progressUpdates],
  );
  const quickFindTerm = quickFindQuery.trim().toLowerCase();
  const quickFindTaskResults = useMemo(() => {
    if (!quickFindTerm) {
      return [];
    }

    return openTasks.filter((task) => {
      const assigneeName = task.assignedTo
        ? workspacePeople.get(task.assignedTo)?.displayName ?? ""
        : "";
      return [task.title, task.description, assigneeName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(quickFindTerm));
    });
  }, [openTasks, quickFindTerm, workspacePeople]);
  const quickFindUploadResults = useMemo(() => {
    if (!quickFindTerm) {
      return [];
    }

    return recentWorkspaceUploads.filter((upload) =>
      [upload.fileName, upload.note, upload.category]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(quickFindTerm)),
    );
  }, [quickFindTerm, recentWorkspaceUploads]);
  const quickFindProgressResults = useMemo(() => {
    if (!quickFindTerm) {
      return [];
    }

    return recentUpdates.filter((update) =>
      [update.note, update.milestoneRef]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(quickFindTerm)),
    );
  }, [quickFindTerm, recentUpdates]);

  const focusComposer = () => {
    if (typeof window === "undefined") {
      chatComposerInputRef.current?.focus();
      return;
    }

    window.requestAnimationFrame(() => {
      chatComposerInputRef.current?.focus();
    });
  };

  const draftChatPrompt = (message: string) => {
    setChatComposerAction("message");
    setIsComposerMenuOpen(false);
    setChatDraft(message);
    focusComposer();
  };

  const remindTaskInChat = (task: WorkspaceTask) => {
    const assigneeName = task.assignedTo
      ? workspacePeople.get(task.assignedTo)?.displayName
      : null;
    const dueStatus = getDueStatus(task.dueDate).label;
    draftChatPrompt(
      `${assigneeName ? `@${assigneeName} ` : ""}reminder about "${task.title}"${task.dueDate ? `, ${dueStatus.toLowerCase()}` : ""}.`,
    );
  };

  const mentionDocInChat = (upload: WorkspaceUpload) => {
    draftChatPrompt(
      `Please review "${upload.fileName}"${upload.note ? ` - ${upload.note}` : ""}.`,
    );
  };
  const progressModal =
    showProgressModal && workspace && canManageWorkspace ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Upload Progress
            </h2>
            <button
              onClick={() => {
                resetProgressForm();
                setShowProgressModal(false);
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            <textarea
              value={progressForm.note}
              onChange={(event) =>
                setProgressForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="What progress did your team make today?"
              className={`min-h-32 w-full rounded-lg border px-4 py-3 text-white ${
                showProgressValidation && progressFormErrors.note
                  ? "border-rose-500/70 bg-rose-500/5"
                  : "border-slate-800 bg-slate-950"
              }`}
            />
            <div
              className={`text-xs ${
                showProgressValidation && progressFormErrors.note
                  ? "text-rose-300"
                  : "text-slate-500"
              }`}
            >
              {showProgressValidation && progressFormErrors.note
                ? progressFormErrors.note
                : "Required. Summarize the milestone reached, blocker solved, or evidence uploaded."}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={progressForm.milestoneRef}
                onChange={(event) =>
                  setProgressForm((current) => ({
                    ...current,
                    milestoneRef: event.target.value,
                  }))
                }
                className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">Select milestone</option>
                {workspace.milestones.map((milestone) => (
                  <option key={milestone._id} value={milestone.name}>
                    {milestone.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                value={progressForm.completionPercent}
                onChange={(event) =>
                  setProgressForm((current) => ({
                    ...current,
                    completionPercent: event.target.value,
                  }))
                }
                placeholder="Completion %"
                className={`rounded-lg border px-4 py-3 text-white ${
                  showProgressValidation &&
                  progressFormErrors.completionPercent
                    ? "border-rose-500/70 bg-rose-500/5"
                    : "border-slate-800 bg-slate-950"
                }`}
              />
            </div>
            <div
              className={`text-xs ${
                showProgressValidation &&
                progressFormErrors.completionPercent
                  ? "text-rose-300"
                  : "text-slate-500"
              }`}
            >
              {showProgressValidation &&
              progressFormErrors.completionPercent
                ? progressFormErrors.completionPercent
                : "Optional. Add completion only when this update should move a milestone forward."}
            </div>
            <label className="block cursor-pointer rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white">
              Attach optional PDF/image
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(event) =>
                  setProgressForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] ?? null,
                  }))
                }
              />
            </label>
            {progressForm.file ? (
              <div className="text-sm text-slate-400">
                {progressForm.file.name}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  resetProgressForm();
                  setShowProgressModal(false);
                }}
                className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setHasAttemptedProgressSubmit(true);
                  if (!isProgressFormValid) {
                    setToast(
                      Object.values(progressFormErrors)[0] ??
                        "Complete the required progress details first.",
                    );
                    return;
                  }
                  progress.mutate();
                }}
                disabled={!isProgressFormValid || progress.isPending}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {progress.isPending ? "Submitting..." : "Submit Progress"}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;
  const taskFormPanel =
    showTaskForm && canManageWorkspace ? (
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-2">
        <input
          value={taskForm.title}
          onChange={(event) =>
            setTaskForm((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          placeholder="Task title"
          className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white md:col-span-2"
        />
        <select
          value={taskForm.priority}
          onChange={(event) =>
            setTaskForm((current) => ({
              ...current,
              priority: event.target.value as WorkspaceTask["priority"],
            }))
          }
          className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
        >
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <input
          type="date"
          value={taskForm.dueDate}
          onChange={(event) =>
            setTaskForm((current) => ({
              ...current,
              dueDate: event.target.value,
            }))
          }
          className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
        />
        <div className="flex justify-end gap-2 md:col-span-2">
          <button
            onClick={() => setShowTaskForm(false)}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => addTask.mutate()}
            disabled={!taskForm.title.trim() || addTask.isPending}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {addTask.isPending ? "Saving..." : "Save Task"}
          </button>
        </div>
      </div>
    ) : null;
  const chatRoster = workspace
    ? [
        ...teamMembers,
        ...(workspace.chatParticipants ?? []).map((participant) => ({
          _id: participant.userId,
          displayName: participant.displayName ?? participant.userId,
          avatar: participant.avatar ?? undefined,
          role: participant.role,
        })),
      ]
    : [];
  const mentionableMembers = useMemo(
    () =>
      chatRoster.filter(
        (member, index, list) =>
          list.findIndex((entry) => entry._id === member._id) === index,
      ),
    [chatRoster],
  );
  const chatMentionQuery = useMemo(
    () => getTrailingMentionQuery(chatDraft),
    [chatDraft],
  );
  const taskMentionQuery = useMemo(
    () => getTrailingMentionQuery(taskAssigneeDraft),
    [taskAssigneeDraft],
  );
  const getMentionSuggestions = (query: string | null) => {
    if (query === null) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return mentionableMembers
      .filter((member) => {
        if (!normalizedQuery) {
          return true;
        }

        return member.displayName.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 6);
  };
  const chatMentionSuggestions = getMentionSuggestions(chatMentionQuery);
  const taskMentionSuggestions = getMentionSuggestions(taskMentionQuery);
  const onlineChatParticipants = useMemo(
    () =>
      chatRoster.filter(
        (member) =>
          chat.onlineUserIds.has(member._id) && member._id !== currentUser?._id,
      ),
    [chat.onlineUserIds, chatRoster, currentUser?._id],
  );
  const typingParticipantNames = useMemo(
    () =>
      chatRoster
        .filter(
          (member) =>
            chat.typingUsers.has(member._id) && member._id !== currentUser?._id,
        )
        .map((member) => member.displayName),
    [chat.typingUsers, chatRoster, currentUser?._id],
  );
  const primaryChatParticipant =
    onlineChatParticipants[0] ??
    chatRoster.find((member) => member._id !== currentUser?._id);
  const typingLabel =
    typingParticipantNames.length === 0
      ? null
      : typingParticipantNames.length === 1
        ? `${typingParticipantNames[0]} is typing...`
        : `${typingParticipantNames[0]} and ${typingParticipantNames.length - 1} more are typing...`;
  const chatPresenceLabel =
    typingLabel ??
    (onlineChatParticipants.length > 0
      ? `${onlineChatParticipants.length} participant${onlineChatParticipants.length > 1 ? "s" : ""} online`
      : "Offline right now");
  const chatComposerActions: Array<{
    id: ChatComposerAction;
    label: string;
    enabled: boolean;
    icon: typeof FileText;
  }> = [
    {
      id: "task",
      label: "Task",
      enabled: workspacePermissions.canAssignAnyTask || workspacePermissions.canAssignToSelf,
      icon: CheckCircle,
    },
    {
      id: "doc",
      label: "Doc",
      enabled: workspacePermissions.canManageDocs,
      icon: FileText,
    },
    {
      id: "progress",
      label: "Progress",
      enabled: workspacePermissions.canManageDocs,
      icon: Upload,
    },
  ];
  const chatPanel = workspace ? (
    <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(8,12,22,0.96)_0%,rgba(5,8,16,0.98)_100%)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden xl:border-r xl:border-slate-800">
        <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {workspace.title}
            </div>
            <div className="truncate text-xs text-slate-400">
              {chatPresenceLabel}
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {chat.messages.length} messages
          </div>
        </div>

        <div className="border-b border-slate-800 px-5 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Focus Now
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Quick reminders and fast shortcuts.
              </div>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            <div className="min-w-0 rounded-[20px] border border-slate-800 bg-slate-950 p-3.5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <CheckCircle className="h-3.5 w-3.5 text-cyan-300" />
                Tasks
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold text-white">
                    {openTasks.length}
                  </div>
                  <div className="text-xs text-slate-400">
                    {myOpenTasks.length} assigned to you
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChatComposerAction("task");
                    focusComposer();
                  }}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            <div className="min-w-0 rounded-[20px] border border-slate-800 bg-slate-950 p-3.5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <Clock className="h-3.5 w-3.5 text-amber-300" />
                Next Follow-Up
              </div>
              {nextAttentionTask ? (
                <>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {nextAttentionTask.title}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {nextAttentionTask.assignedTo
                          ? workspacePeople.get(nextAttentionTask.assignedTo)
                              ?.displayName ?? "Assigned teammate"
                          : "Unassigned"}
                      </div>
                      <div
                        className={`mt-1 text-xs ${getDueStatus(nextAttentionTask.dueDate).tone}`}
                      >
                        {getDueStatus(nextAttentionTask.dueDate).label}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remindTaskInChat(nextAttentionTask)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                    >
                      <Send className="h-3.5 w-3.5 text-sky-300" />
                      Remind
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-400">
                  No open tasks need follow-up right now.
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-[20px] border border-slate-800 bg-slate-950 p-3.5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <FileText className="h-3.5 w-3.5 text-emerald-300" />
                Latest Doc
              </div>
              {latestWorkspaceUpload ? (
                <>
                  <div className="mt-2 truncate text-sm font-semibold text-white">
                    {latestWorkspaceUpload.fileName}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {dt(latestWorkspaceUpload.uploadedAt)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openFileInNewTab(latestWorkspaceUpload.fileUrl)
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                    >
                      <Eye className="h-3.5 w-3.5 text-cyan-300" />
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => mentionDocInChat(latestWorkspaceUpload)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                    >
                      <Send className="h-3.5 w-3.5 text-sky-300" />
                      Mention
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-400">
                  No shared docs yet. Upload one from the composer menu.
                </div>
              )}
            </div>
          </div>

          {latestProgressUpdate ? (
            <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-300">
              <Rocket className="h-3.5 w-3.5 text-sky-300" />
              <span className="font-semibold text-white">Latest progress:</span>
              <span className="truncate">{latestProgressUpdate.note}</span>
            </div>
          ) : null}
        </div>

        <div
          ref={chatScrollerRef}
          className="h-[520px] overflow-y-auto px-5 py-5"
        >
        <div className="space-y-3">
          {chat.messages.length === 0 ? (
            <div className="mx-auto max-w-md text-center text-sm text-slate-400">
              Start the thread with a message, a shared doc, a task, or a progress update.
            </div>
          ) : null}

          {chat.messages.map((message) => {
            const sender =
              teamMembers.find((member) => member._id === message.senderId) ??
              (workspace.chatParticipants ?? []).find(
                (participant) => participant.userId === message.senderId,
              );
            const isOwn = message.senderId === currentUser?._id;
            const messageState = chat.messageStatus.get(message._id);
            const deliveredAt = messageState?.deliveredAt ?? message.deliveredAt;
            const seenBy = messageState?.seenBy ?? message.seenBy ?? [];
            const seenByOthers = seenBy.filter(
              (userId) => userId !== currentUser?._id,
            );
            const seenByNames = seenByOthers
              .map(
                (userId) =>
                  chatRoster.find((member) => member._id === userId)?.displayName ??
                  "Member",
              )
              .filter(Boolean);
            const attachment = getChatAttachment(message);
            const isSeen = seenByOthers.length > 0;
            const activityMessage = parseWorkspaceActivityMessage(
              message.message,
            );

            return (
              <div
                key={message._id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[82%] md:max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                  {!isOwn ? (
                    <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-300/90">
                      {sender?.displayName ?? "Member"}
                    </div>
                  ) : null}

                  <div
                    className={`w-full rounded-2xl px-4 py-3 ${
                      isOwn
                        ? "bg-emerald-500/12 text-white ring-1 ring-emerald-400/15"
                        : "bg-slate-900 text-white ring-1 ring-slate-800"
                    }`}
                  >
                    {attachment?.fileType === "image" ? (
                      <button
                        type="button"
                        onClick={() => openFileInNewTab(attachment.fileUrl)}
                        className="mb-3 block overflow-hidden rounded-xl bg-black/30"
                      >
                        <img
                          src={attachment.fileUrl}
                          alt={attachment.fileName}
                          className="max-h-72 w-full object-cover"
                        />
                      </button>
                    ) : null}

                    {attachment && attachment.fileType !== "image" ? (
                      <button
                        type="button"
                        onClick={() => openFileInNewTab(attachment.fileUrl)}
                        className={`mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                          isOwn
                            ? "bg-emerald-500/8 hover:bg-emerald-500/14"
                            : "bg-slate-950 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-slate-300">
                          {getAttachmentIcon(attachment.fileType)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">
                            {attachment.fileName}
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                            {String(attachment.fileType).toUpperCase()} •{" "}
                            {formatFileSize(attachment.fileSizeBytes)}
                          </div>
                        </div>
                        <Download className="h-4 w-4 text-slate-400" />
                      </button>
                    ) : null}

                    {message.codeSnippet?.code ? (
                      <div className="mb-3 overflow-hidden rounded-xl bg-[#0b1220] ring-1 ring-white/10">
                        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                          <div className="flex items-center gap-2">
                            <FileCode2 className="h-3.5 w-3.5" />
                            {message.codeSnippet.title}
                          </div>
                          <span>{message.codeSnippet.language}</span>
                        </div>
                        <pre className="max-h-64 overflow-auto px-3 py-3 text-xs leading-6 text-slate-100">
                          <code>{message.codeSnippet.code}</code>
                        </pre>
                      </div>
                    ) : null}

                    {activityMessage ? (
                      <div className="space-y-2">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {activityMessage.badge}
                        </span>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                          {activityMessage.body}
                        </p>
                      </div>
                    ) : message.message ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                        {message.message}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className={`mt-1 flex items-center gap-1.5 px-1 text-[10px] ${
                      isOwn ? "justify-end text-slate-400" : "justify-start text-slate-500"
                    }`}
                  >
                    <span>{dt(message.sentAt)}</span>
                    {isOwn &&
                      (isSeen ? (
                        <span className="font-medium text-sky-400">••</span>
                      ) : deliveredAt ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      ))}
                  </div>

                  {isOwn && seenByNames.length > 0 ? (
                    <div className="mt-0.5 px-1 text-right text-[10px] text-sky-400/90">
                      Seen by {seenByNames.join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {typingLabel ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-3 rounded-full bg-slate-900 px-3 py-2 text-xs text-slate-300 ring-1 ring-slate-800">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.25s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                </div>
                <span>{typingLabel}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

        <div className="border-t border-slate-800 px-5 py-5">
          <div className="relative space-y-4">
            {chatComposerAction === "task" ? (
              <div className="space-y-4 rounded-[24px] border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Create Task
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Use `@mention` to assign the task.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskForm((current) => ({
                        ...current,
                        title: "",
                        dueDate: "",
                        assignedTo:
                          workspacePermissions.canAssignAnyTask
                            ? ""
                            : currentUser?._id ?? "",
                      }));
                      setTaskAssigneeDraft(
                        workspacePermissions.canAssignAnyTask
                          ? ""
                          : currentUser?.displayName
                            ? `@${currentUser.displayName}`
                            : "",
                      );
                      setChatComposerAction("message");
                    }}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-900 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={taskForm.title}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Task title"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                />
                <div className="grid gap-3 xl:grid-cols-[160px_170px_minmax(0,1fr)_120px]">
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        priority: event.target.value as WorkspaceTask["priority"],
                      }))
                    }
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                  <div className="relative">
                    <input
                      value={taskAssigneeDraft}
                      onChange={(event) => {
                        setTaskAssigneeDraft(event.target.value);
                        if (!workspacePermissions.canAssignAnyTask) {
                          setTaskForm((current) => ({
                            ...current,
                            assignedTo: currentUser?._id ?? current.assignedTo,
                          }));
                        } else if (!event.target.value.includes("@")) {
                          setTaskForm((current) => ({
                            ...current,
                            assignedTo: "",
                          }));
                        }
                      }}
                      placeholder={
                        workspacePermissions.canAssignAnyTask
                          ? "@assignee"
                          : "Assigned to you"
                      }
                      disabled={!workspacePermissions.canAssignAnyTask}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-70 disabled:text-slate-500"
                  />
                    {workspacePermissions.canAssignAnyTask &&
                    taskMentionQuery !== null &&
                    taskMentionSuggestions.length > 0 ? (
                      <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                        {taskMentionSuggestions.map((member) => (
                          <button
                            key={member._id}
                            type="button"
                            onClick={() => assignTaskMention(member._id)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-900"
                          >
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[11px] font-bold text-white">
                              {member.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt={member.displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                initials(member.displayName)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {member.displayName}
                              </div>
                              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                {member.role}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void submitTaskFromChat()}
                    disabled={!taskForm.title.trim() || addTask.isPending}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 xl:self-stretch"
                  >
                    {addTask.isPending ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            ) : null}

            {chatComposerAction === "doc" ? (
              <div className="space-y-4 rounded-[24px] border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Share Document
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Upload a file and add a short note.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setChatDocFile(null);
                      setUploadNote("");
                      setUploadCategory("other");
                      setChatComposerAction("message");
                    }}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-900 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 xl:grid-cols-[180px_180px_minmax(0,1fr)_110px]">
                  <button
                    type="button"
                    onClick={() => chatDocInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <FileText className="h-4 w-4 text-cyan-300" />
                    {chatDocFile ? "Replace file" : "Choose file"}
                  </button>
                  <select
                    value={uploadCategory}
                    onChange={(event) =>
                      setUploadCategory(
                        event.target.value as WorkspaceUploadCategory,
                      )
                    }
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option value="other">Other</option>
                    <option value="bug_report">Bug report</option>
                    <option value="error_log">Error log</option>
                    <option value="screenshot">Screenshot</option>
                    <option value="test_result">Test result</option>
                    <option value="design_mockup">Design mockup</option>
                  </select>
                  <input
                    value={uploadNote}
                    onChange={(event) => setUploadNote(event.target.value)}
                    placeholder="Add note or mention someone with @"
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void submitDocFromChat()}
                    disabled={!chatDocFile}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 xl:self-stretch"
                  >
                    Share
                  </button>
                </div>
                {chatDocFile ? (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-800 px-3 py-2 text-xs text-slate-300">
                    {getAttachmentIcon(
                      chatDocFile.type.startsWith("image/") ? "image" : "doc",
                    )}
                    <span className="truncate">{chatDocFile.name}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {chatComposerAction === "progress" ? (
              <div className="space-y-4 rounded-[24px] border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Log Progress
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Share milestone progress directly into the thread.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetProgressForm();
                      setChatComposerAction("message");
                    }}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-900 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={progressForm.note}
                  onChange={(event) =>
                    setProgressForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="What changed today?"
                  className={`min-h-24 w-full rounded-xl border px-4 py-3 text-sm text-white ${
                    showProgressValidation && progressFormErrors.note
                      ? "border-rose-500/70 bg-rose-500/5"
                      : "border-slate-800 bg-slate-950"
                  }`}
                />
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_140px_170px_96px]">
                  <select
                    value={progressForm.milestoneRef}
                    onChange={(event) =>
                      setProgressForm((current) => ({
                        ...current,
                        milestoneRef: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option value="">Select milestone</option>
                    {workspace.milestones.map((milestone) => (
                      <option key={milestone._id} value={milestone.name}>
                        {milestone.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={progressForm.completionPercent}
                    onChange={(event) =>
                      setProgressForm((current) => ({
                        ...current,
                        completionPercent: event.target.value,
                      }))
                    }
                    placeholder="%"
                    className={`rounded-xl border px-4 py-3 text-sm text-white ${
                      showProgressValidation &&
                      progressFormErrors.completionPercent
                        ? "border-rose-500/70 bg-rose-500/5"
                        : "border-slate-800 bg-slate-950"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => chatProgressInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Upload className="h-4 w-4 text-sky-300" />
                    {progressForm.file ? "Replace" : "Evidence"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitProgressFromChat()}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white xl:self-stretch"
                  >
                    Post
                  </button>
                </div>
              </div>
            ) : null}

            {chatAttachment ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 px-3 py-2 text-xs text-slate-300">
                  {getAttachmentIcon(
                    chatAttachment.type.startsWith("image/") ? "image" : "doc",
                  )}
                  <span>{chatAttachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setChatAttachment(null)}
                    className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-900 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="relative flex items-center gap-3 border-t border-slate-800 pt-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsComposerMenuOpen((value) => !value)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-white transition hover:border-slate-600 hover:bg-slate-900"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {isComposerMenuOpen ? (
                  <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-30 w-56 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                    {workspacePermissions.canManageDocs ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsComposerMenuOpen(false);
                          imageAttachmentInputRef.current?.click();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white transition hover:bg-slate-900"
                      >
                        <ImagePlus className="h-4 w-4 text-sky-300" />
                        Upload image
                      </button>
                    ) : null}
                    {chatComposerActions
                      .filter((action) => action.enabled)
                      .map((action) => {
                        const ActionIcon = action.icon;
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => {
                              setChatComposerAction(action.id);
                              setIsComposerMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white transition hover:bg-slate-900"
                          >
                            <ActionIcon className="h-4 w-4 text-cyan-300" />
                            {action.id === "doc" ? "Share document" : action.label}
                          </button>
                        );
                      })}
                  </div>
                ) : null}
              </div>

              <div className="relative flex-1">
                <textarea
                  ref={chatComposerInputRef}
                  value={chatDraft}
                  onChange={(event) => {
                    setChatDraft(event.target.value);
                    chat.sendTyping();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                    if (event.key === "Escape") {
                      setIsComposerMenuOpen(false);
                    }
                  }}
                  placeholder={
                    chatComposerAction === "message"
                      ? "Type a message. Use @ to mention teammates."
                      : `Finish the ${chatComposerAction} action above, or continue chatting here.`
                  }
                  className="min-h-[44px] max-h-28 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                {chatMentionQuery !== null && chatMentionSuggestions.length > 0 ? (
                  <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-20 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                    {chatMentionSuggestions.map((member) => (
                      <button
                        key={member._id}
                        type="button"
                        onClick={() => insertChatMention(member._id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-900"
                      >
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[11px] font-bold text-white">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initials(member.displayName)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {member.displayName}
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            {member.role}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={isSendingChat || (!chatDraft.trim() && !chatAttachment)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isSendingChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>

          <input
            ref={imageAttachmentInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onChatAttachmentFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={docAttachmentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(event) => {
              onChatAttachmentFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={chatDocInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && file.size > 10 * 1024 * 1024) {
                setToast("Chat attachments must be 10MB or less.");
              } else {
                setChatDocFile(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={chatProgressInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && file.size > 10 * 1024 * 1024) {
                setToast("Chat attachments must be 10MB or less.");
              } else {
                setProgressForm((current) => ({
                  ...current,
                  file,
                }));
              }
              event.currentTarget.value = "";
            }}
          />
          </div>
        </div>
      </div>

      <aside className="bg-slate-950 xl:min-h-full xl:border-l xl:border-slate-800">
        <div className="flex min-h-[64px] items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Participants
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {chatRoster.length} total
            </div>
          </div>
          {!embedded ? (
            <button
              onClick={() => setShowNegotiationPanel((value) => !value)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-amber-200 transition hover:text-amber-100"
            >
              <Users2 className="h-3.5 w-3.5" />
              Chat Access
            </button>
          ) : null}
        </div>
        <div className="max-h-[684px] overflow-y-auto overflow-x-hidden px-5 py-4">
          <div className="mb-5 rounded-[20px] border border-slate-800 bg-slate-950 p-3.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Quick Find
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={quickFindQuery}
                onChange={(event) => setQuickFindQuery(event.target.value)}
                placeholder="Search tasks, docs, progress"
                className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950 px-10 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            {quickFindTerm ? (
              <div className="mt-4 space-y-4">
                {quickFindTaskResults.length > 0 ? (
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Tasks
                    </div>
                    <div className="space-y-2">
                      {quickFindTaskResults.slice(0, 3).map((task) => (
                        <button
                          key={task._id}
                          type="button"
                          onClick={() => remindTaskInChat(task)}
                          className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left transition hover:border-slate-600"
                        >
                          <div className="truncate text-sm font-semibold text-white">
                            {task.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-400">
                            {task.assignedTo
                              ? workspacePeople.get(task.assignedTo)
                                  ?.displayName ?? "Assigned teammate"
                              : "Unassigned"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {quickFindUploadResults.length > 0 ? (
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Docs
                    </div>
                    <div className="space-y-2">
                      {quickFindUploadResults.slice(0, 3).map((upload) => (
                        <button
                          key={upload._id}
                          type="button"
                          onClick={() => openFileInNewTab(upload.fileUrl)}
                          className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left transition hover:border-slate-600"
                        >
                          <div className="truncate text-sm font-semibold text-white">
                            {upload.fileName}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-400">
                            {upload.note || upload.category || "Shared file"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {quickFindProgressResults.length > 0 ? (
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Progress
                    </div>
                    <div className="space-y-2">
                      {quickFindProgressResults.slice(0, 2).map((update) => (
                        <div
                          key={update._id}
                          className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5"
                        >
                          <div className="line-clamp-2 text-sm text-white">
                            {update.note}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {update.milestoneRef || "General update"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {quickFindTaskResults.length === 0 &&
                quickFindUploadResults.length === 0 &&
                quickFindProgressResults.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-400">
                    No matching tasks, docs, or progress notes.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {myOpenTasks[0] ? (
                  <button
                    type="button"
                    onClick={() => remindTaskInChat(myOpenTasks[0])}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left transition hover:border-slate-600"
                  >
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Your next task
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">
                        {myOpenTasks[0].title}
                      </div>
                    </div>
                    <Send className="h-4 w-4 shrink-0 text-sky-300" />
                  </button>
                ) : null}

                {latestWorkspaceUpload ? (
                  <button
                    type="button"
                    onClick={() => openFileInNewTab(latestWorkspaceUpload.fileUrl)}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left transition hover:border-slate-600"
                  >
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Recent doc
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">
                        {latestWorkspaceUpload.fileName}
                      </div>
                    </div>
                    <Eye className="h-4 w-4 shrink-0 text-cyan-300" />
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {chatRoster.map((member) => {
              const isOnline = chat.onlineUserIds.has(member._id);
              const isCurrentUser = member._id === currentUser?._id;
              return (
                <div
                  key={member._id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950 px-3 py-3"
                >
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-bold text-white">
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.displayName}
                        className="h-10 w-10 object-cover"
                      />
                    ) : (
                      initials(member.displayName)
                    )}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${
                        isOnline ? "bg-emerald-400" : "bg-slate-700"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {member.displayName}
                      {isCurrentUser ? " (You)" : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      {isOnline ? "Active now" : "Offline"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {workspacePermissions.canInviteMembers ? (
            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Founder Access
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    Invite teammates
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteForm((value) => !value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    showInviteForm
                      ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
                      : "border-slate-700 text-white hover:border-slate-500"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {showInviteForm ? "Close" : "Invite"}
                </button>
              </div>

              {showInviteForm ? (
                <div className="space-y-3 rounded-[24px] border border-slate-800 bg-slate-950 p-4">
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="student@college.edu"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as typeof inviteRole)
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option value="developer">Developer</option>
                    <option value="designer">Designer</option>
                    <option value="researcher">Researcher</option>
                    <option value="marketer">Marketer</option>
                    <option value="lead">Lead</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    value={inviteMessage}
                    onChange={(event) => setInviteMessage(event.target.value)}
                    placeholder="Message or onboarding context"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => invite.mutate()}
                    disabled={!inviteEmail.trim() || invite.isPending}
                    className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {invite.isPending ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!currentUser?._id) {
      return;
    }

    chat.messages.forEach((message) => {
      if (message.senderId === currentUser._id) {
        return;
      }

      const status = chat.messageStatus.get(message._id);
      if (!status?.deliveredAt && !message.deliveredAt) {
        chat.markDelivered(message._id);
      }
    });
  }, [chat.markDelivered, chat.messageStatus, chat.messages, currentUser?._id]);

  useEffect(() => {
    if (activeTab !== "chat" || !currentUser?._id) {
      return;
    }

    chat.messages.forEach((message) => {
      if (message.senderId === currentUser._id) {
        return;
      }

      const status = chat.messageStatus.get(message._id);
      const seenBy = status?.seenBy ?? message.seenBy ?? [];
      if (!seenBy.includes(currentUser._id)) {
        chat.markSeen(message._id);
      }
    });
  }, [
    activeTab,
    chat.markSeen,
    chat.messageStatus,
    chat.messages,
    currentUser?._id,
  ]);

  useEffect(() => {
    if (activeTab !== "chat" || !chatScrollerRef.current) {
      return;
    }

    chatScrollerRef.current.scrollTo({
      top: chatScrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeTab, chat.messages.length, typingParticipantNames.length]);

  if (embedded) {
    return (
      <div className="space-y-6 p-4">
        {workspace ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">{workspace.title}</h1>
                <p className="text-sm text-slate-400">{workspace.category} - {workspace.progressPercent}%</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_320px]">
                <section className="rounded-[28px] border border-slate-800 bg-slate-900 p-6">
                  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                        Delivery track
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Milestones
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Keep the execution path visible before jumping into tasks,
                        team coordination, docs, or chat.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-right">
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Current target
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {nextMilestone}
                        </div>
                      </div>
                      {canManageWorkspace && (
                        <button
                          onClick={() => {
                            setHasAttemptedProgressSubmit(false);
                            setShowProgressModal(true);
                          }}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                        >
                          Upload Progress
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {workspace.milestones.map((milestone) => (
                      <div
                        key={milestone._id}
                        className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 md:grid-cols-[44px_minmax(0,1fr)_64px] md:items-center"
                      >
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                            milestone.isCompleted
                              ? "bg-emerald-500/12"
                              : milestone.completionPercent > 0
                                ? "bg-sky-500/12"
                                : "bg-slate-800"
                          }`}
                        >
                          {milestone.isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Circle
                              className={`h-5 w-5 ${
                                milestone.completionPercent > 0
                                  ? "text-sky-400"
                                  : "text-slate-600"
                              }`}
                            />
                          )}
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="font-semibold text-white">
                              {milestone.name}
                            </h3>
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              {milestone.isCompleted ? "Complete" : "In progress"}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full transition-all ${
                                milestone.isCompleted
                                  ? "bg-emerald-500"
                                  : "bg-gradient-to-r from-blue-500 to-fuchsia-500"
                              }`}
                              style={{ width: `${milestone.completionPercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right text-lg font-semibold text-white">
                          {milestone.completionPercent}%
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="space-y-6">
                  <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <h3 className="font-semibold text-white">Project Stats</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-950 p-4 text-center">
                        <div className="text-2xl font-bold text-white">
                          {completedTaskCount}
                        </div>
                        <div className="text-xs text-slate-400">Tasks Done</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 p-4 text-center">
                        <div className="text-2xl font-bold text-white">
                          {openTaskCount}
                        </div>
                        <div className="text-xs text-slate-400">Open Tasks</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 p-4 text-center">
                        <div className="text-2xl font-bold text-white">
                          {teamMembers.length}
                        </div>
                        <div className="text-xs text-slate-400">Team Members</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 p-4 text-center">
                        <div className="text-2xl font-bold text-white">
                          {evidenceCount}
                        </div>
                        <div className="text-xs text-slate-400">Docs</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <h3 className="font-semibold text-white">Recent Updates</h3>
                    <div className="mt-4 space-y-3">
                      {recentUpdates.length > 0 ? (
                        recentUpdates.map((update) => {
                          const author = teamMembers.find(
                            (member) => member._id === update.submittedBy,
                          );
                          return (
                            <div key={update._id} className="text-sm">
                              <div className="font-semibold text-white">
                                {author?.displayName ?? "Team member"}
                              </div>
                              <div className="text-slate-400">{update.note}</div>
                              <div className="text-xs text-slate-500">
                                {dt(update.submittedAt)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-sm text-slate-400">
                          Progress updates will appear here after your first upload.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

                <section
                  className={`${
                    activeTab === "chat"
                      ? "bg-transparent p-0"
                      : "rounded-[28px] border border-slate-800 bg-slate-900 p-4 lg:p-6"
                  }`}
                >
                  <div className="mb-5 flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                        Workbench
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Chat
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Collaboration, file sharing, task capture, and progress updates now run through one conversation surface.
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      activeTab === "chat"
                        ? "p-0"
                        : "rounded-2xl border border-slate-800 bg-slate-950 p-4"
                    }
                  >
                  {activeTab === "tasks" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">{completedTaskCount} completed, {openTaskCount} open</div>
                        {canManageWorkspace && <button onClick={() => setShowTaskForm(!showTaskForm)} className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white">Add Task</button>}
                      </div>
                      {taskFormPanel}
                      <div className="space-y-2">
                        {(workspace.tasks ?? []).map((task) => (
                          <div key={task._id} className="flex items-start gap-2 p-2 rounded border border-slate-800 bg-slate-950">
                            <button onClick={() => toggleTask.mutate({ taskId: task._id, done: !task.done })} disabled={!canManageWorkspace}>
                              {task.done ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                            </button>
                            <div className="flex-1">
                              <div className={`text-sm ${task.done ? "text-slate-500 line-through" : "text-white"}`}>{task.title}</div>
                              <div className="text-xs text-slate-500">{task.priority} - Due {d(task.dueDate)}</div>
                            </div>
                            {canManageWorkspace && <button onClick={() => deleteTask.mutate(task._id)}><Trash2 className="h-4 w-4 text-slate-500" /></button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "team" && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm text-slate-300">
                            {teamMembers.length} member{teamMembers.length === 1 ? "" : "s"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {pendingInvites.length > 0
                              ? `${pendingInvites.length} pending invite${pendingInvites.length === 1 ? "" : "s"}`
                              : "Invite student collaborators into this workspace."}
                          </div>
                        </div>
                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => setShowInviteForm((value) => !value)}
                            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                              showInviteForm
                                ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                                : "border-slate-700 bg-slate-950 text-white hover:border-slate-500"
                            }`}
                          >
                            {showInviteForm ? "Close Invite" : "Invite Teammate"}
                          </button>
                        ) : null}
                      </div>

                      {showInviteForm ? (
                        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                            <input
                              value={inviteEmail}
                              onChange={(event) => setInviteEmail(event.target.value)}
                              placeholder="student@college.edu"
                              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                            />
                            <select
                              value={inviteRole}
                              onChange={(event) =>
                                setInviteRole(event.target.value as typeof inviteRole)
                              }
                              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
                            >
                              <option value="developer">Developer</option>
                              <option value="designer">Designer</option>
                              <option value="researcher">Researcher</option>
                              <option value="marketer">Marketer</option>
                              <option value="lead">Lead</option>
                              <option value="other">Other</option>
                            </select>
                            <input
                              value={inviteMessage}
                              onChange={(event) => setInviteMessage(event.target.value)}
                              placeholder="Message or onboarding context"
                              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white lg:col-span-2"
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">
                              Team invites are for student collaborators only.
                            </div>
                            <button
                              type="button"
                              onClick={() => invite.mutate()}
                              disabled={!inviteEmail.trim() || invite.isPending}
                              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {invite.isPending ? "Sending..." : "Send Invite"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {pendingInvites.length > 0 ? (
                        <div className="space-y-2">
                          {pendingInvites.map((pendingInvite) => (
                            <div
                              key={pendingInvite._id}
                              className="flex flex-col gap-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {pendingInvite.displayName || pendingInvite.email || "Pending invite"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {pendingInvite.email ?? "No email"} / {pendingInvite.proposedRole}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500">
                                Sent {dt(pendingInvite.createdAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {teamMembers.map((m) => (
                          <div
                            key={m._id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3"
                          >
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-bold text-white">
                              {m.avatar ? (
                                <img src={m.avatar} className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                initials(m.displayName)
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-white">{m.displayName}</div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{m.role}</div>
                            </div>
                            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {m._id === workspace.ownerId ? "Owner" : "Member"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "uploads" && (
                    <div className="space-y-3">
                      <div className="text-sm text-slate-400">
                        {(workspace.uploads ?? []).length} document{(workspace.uploads ?? []).length === 1 ? "" : "s"}
                      </div>
                      <div className="space-y-2">
                        {(workspace.uploads ?? []).map((upload) => (
                          <div
                            key={upload._id}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0 flex items-start gap-3">
                              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-slate-300">
                                {getAttachmentIcon(upload.fileType)}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{upload.fileName}</div>
                                <div className="text-xs text-slate-500">
                                  {String(upload.fileType).toUpperCase()} / {formatFileSize(upload.fileSizeBytes)} / {upload.category ?? "other"} / {dt(upload.uploadedAt)}
                                </div>
                                {upload.note ? (
                                  <div className="mt-1 text-sm text-slate-400">{upload.note}</div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {isInlinePreviewableFileType(upload.fileType) ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedUpload(upload)}
                                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Preview
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openFileInNewTab(upload.fileUrl)}
                                className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "chat" ? chatPanel : null}
                  {false && activeTab === "chat" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{workspace?.title}</div>
                          <div className="text-xs text-slate-400">
                            {typingLabel ??
                              (onlineChatParticipants.length > 0
                                ? `${onlineChatParticipants.length} participant${onlineChatParticipants.length > 1 ? "s" : ""} online`
                                : "Offline right now")}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{chat.messages.length} messages</div>
                      </div>
<div
                          ref={chatScrollerRef}
                          className="h-[500px] overflow-y-auto bg-[#0d0d0d] px-3 py-3"
                        >
                          <div className="space-y-1">
                            {chat.messages.length === 0 ? (
                              <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm text-slate-300 shadow-sm">
                                Start the thread with an update, an image, a document, or a code snippet.
                              </div>
                            ) : null}
                            {chat.messages.map((message) => {
                              const sender =
                                teamMembers.find((member) => member._id === message.senderId) ??
                                (workspace?.chatParticipants ?? []).find(
                                  (participant) => participant.userId === message.senderId,
                                );
                              const isOwn = message.senderId === currentUser?._id;
                              const messageState = chat.messageStatus.get(message._id);
                              const deliveredAt = messageState?.deliveredAt ?? message.deliveredAt;
                              const seenBy = messageState?.seenBy ?? message.seenBy ?? [];
                              const seenByOthers = seenBy.filter(
                                (userId) => userId !== currentUser?._id,
                              );
                              const seenByNames = seenByOthers
                                .map(
                                  (userId) =>
                                    chatRoster.find((member) => member._id === userId)
                                      ?.displayName ?? "Member",
                                )
                                .filter(Boolean);
                              const attachment = getChatAttachment(message);
                              const isSeen = seenByOthers.length > 0;

                              return (
                                <div
                                  key={message._id}
                                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 md:max-w-[70%] ${
                                      isOwn
                                        ? "bg-emerald-700 text-white"
                                        : "bg-slate-800 text-white"
                                    }`}
                                  >
                                    {!isOwn ? (
                                      <div className="mb-0.5 text-xs font-medium text-cyan-400">
                                        {sender?.displayName ?? "Member"}
                                      </div>
                                    ) : null}

                                    {attachment?.fileType === "image" ? (
                                      <button
                                        type="button"
                                        onClick={() => openFileInNewTab(attachment.fileUrl)}
                                        className="mb-2 block overflow-hidden rounded-lg bg-slate-900"
                                      >
                                        <img
                                          src={attachment.fileUrl}
                                          alt={attachment.fileName}
                                          className="max-h-56 w-full object-cover"
                                        />
                                      </button>
                                    ) : null}

                                    {attachment && attachment.fileType !== "image" ? (
                                    <button
                                      type="button"
                                      onClick={() => openFileInNewTab(attachment.fileUrl)}
                                      className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                                        isOwn
                                          ? "bg-sky-900/40 hover:bg-sky-900/55"
                                          : "bg-slate-800 hover:bg-slate-700"
                                      }`}
                                    >
                                      <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                          isOwn
                                            ? "bg-sky-950 text-sky-200"
                                            : "bg-slate-950 text-slate-300"
                                        }`}
                                      >
                                        {getAttachmentIcon(attachment.fileType)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div
                                          className={`truncate text-sm font-semibold ${
                                            isOwn ? "text-sky-50" : "text-white"
                                          }`}
                                        >
                                          {attachment.fileName}
                                        </div>
                                        <div
                                          className={`text-xs ${
                                            isOwn ? "text-sky-200/80" : "text-slate-400"
                                          }`}
                                        >
                                          {String(attachment.fileType).toUpperCase()} ·{" "}
                                          {formatFileSize(attachment.fileSizeBytes)}
                                        </div>
                                      </div>
                                      <Download
                                        className={`h-4 w-4 ${
                                          isOwn ? "text-sky-200/80" : "text-slate-400"
                                        }`}
                                      />
                                    </button>
                                  ) : null}

                                  {message.codeSnippet?.code ? (
                                    <div className="mb-2 overflow-hidden rounded-2xl border border-[#d1d7db] bg-[#111b21] text-white">
                                      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                                        <div className="flex items-center gap-2">
                                          <FileCode2 className="h-4 w-4" />
                                          {message.codeSnippet.title}
                                        </div>
                                        <span>{message.codeSnippet.language}</span>
                                      </div>
                                      <pre className="max-h-64 overflow-auto px-3 py-3 text-xs leading-6 text-slate-100">
                                        <code>{message.codeSnippet.code}</code>
                                      </pre>
                                    </div>
                                  ) : null}

                                  {message.message ? (
                                    <p className="whitespace-pre-wrap break-words text-[14px] leading-6">
                                      {message.message}
                                    </p>
                                  ) : null}

<div
                                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                      isOwn ? "text-white/70" : "text-slate-400"
                                    }`}
                                  >
                                    <span>{dt(message.sentAt)}</span>
                                    {isOwn && (
                                      isSeen ? (
                                        <span className="text-blue-400 font-medium">✓✓</span>
                                      ) : deliveredAt ? (
                                        <CheckCheck className="h-3 w-3" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )
                                    )}
                                  </div>

                                  {isOwn && seenByNames.length > 0 ? (
                                    <div className="mt-1 text-right text-[10px] text-blue-400">
                                      Seen by {seenByNames.join(", ")}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}

                          {typingLabel ? (
                            <div className="flex justify-start">
                              <div className="inline-flex items-center gap-3 rounded-[20px] bg-slate-900 px-3 py-2 text-xs text-slate-300 shadow-sm">
                                <div className="flex items-center gap-1">
                                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.25s]" />
                                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s]" />
                                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                                </div>
                                <span>{typingLabel}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-3xl border border-slate-800 bg-slate-900 px-3 py-3">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {canManageWorkspace ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => imageAttachmentInputRef.current?.click()}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                                >
                                  <ImagePlus className="h-3.5 w-3.5 text-sky-300" />
                                  Upload Image
                                </button>
                                <button
                                  type="button"
                                  onClick={() => docAttachmentInputRef.current?.click()}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                                >
                                  <FileText className="h-3.5 w-3.5 text-cyan-300" />
                                  Upload Docs
                                </button>
                              </>
                            ) : (
                              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                                File uploads are limited to workspace student collaborators.
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setChatComposerMode((current) =>
                                  current === "code" ? "text" : "code",
                                )
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                chatComposerMode === "code"
                                  ? "border-violet-400/40 bg-violet-500/10 text-violet-100"
                                  : "border-slate-700 bg-slate-900 text-white hover:border-slate-500"
                              }`}
                            >
                              <Code2 className="h-3.5 w-3.5 text-violet-300" />
                              Upload Code
                            </button>
                          </div>

                          {chatComposerMode === "code" ? (
                            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-white">
                                  Send code safely as plain text
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setChatComposerMode("text");
                                    setChatCodeSnippet({
                                      title: "",
                                      language: "typescript",
                                      code: "",
                                    });
                                  }}
                                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                                <input
                                  value={chatCodeSnippet.title}
                                  onChange={(event) => {
                                    setChatCodeSnippet((current) => ({
                                      ...current,
                                      title: event.target.value,
                                    }));
                                    chat.sendTyping();
                                  }}
                                  placeholder="Snippet title"
                                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                                />
                                <input
                                  value={chatCodeSnippet.language}
                                  onChange={(event) => {
                                    setChatCodeSnippet((current) => ({
                                      ...current,
                                      language: event.target.value,
                                    }));
                                    chat.sendTyping();
                                  }}
                                  placeholder="Language"
                                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                                />
                              </div>
                              <textarea
                                value={chatCodeSnippet.code}
                                onChange={(event) => {
                                  setChatCodeSnippet((current) => ({
                                    ...current,
                                    code: event.target.value,
                                  }));
                                  chat.sendTyping();
                                }}
                                placeholder="Paste code here. It is stored as plain text only and never executed on the server."
                                className="mt-3 min-h-40 w-full rounded-2xl border border-slate-700 bg-[#111b21] px-4 py-3 font-mono text-xs text-slate-100 placeholder:text-slate-500"
                              />
                            </div>
                          ) : null}

                          {chatAttachment || chatCodeSnippet.code.trim() ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {chatAttachment ? (
                                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                  {getAttachmentIcon(
                                    chatAttachment?.type.startsWith("image/")
                                      ? "image"
                                      : "doc",
                                  )}
                                  <span>{chatAttachment?.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setChatAttachment(null)}
                                    className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : null}
                              {chatCodeSnippet.code.trim() ? (
                                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                  <FileCode2 className="h-3.5 w-3.5 text-violet-300" />
                                  <span>
                                    {chatCodeSnippet.title.trim() || "Code snippet ready"}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="flex items-end gap-2">
                            <div className="flex-1 rounded-[26px] bg-[#2a3942] px-4 py-2.5">
                              <textarea
                                value={chatDraft}
                                onChange={(event) => {
                                  setChatDraft(event.target.value);
                                  chat.sendTyping();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    void sendMessage();
                                  }
                                }}
                                placeholder={
                                  chatComposerMode === "code"
                                    ? "Add a caption for this code snippet..."
                                    : "Type a message"
                                }
                                className="max-h-28 min-h-[28px] w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => void sendMessage()}
                              disabled={
                                isSendingChat ||
                                (!chatDraft.trim() &&
                                  !chatAttachment &&
                                  !chatCodeSnippet.code.trim())
                              }
                              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                            >
                              {isSendingChat ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          <input
                            ref={imageAttachmentInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              onChatAttachmentFile(event.target.files?.[0] ?? null);
                              event.currentTarget.value = "";
                            }}
                          />
                          <input
                            ref={docAttachmentInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                            className="hidden"
                            onChange={(event) => {
                              onChatAttachmentFile(event.target.files?.[0] ?? null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </section>

            </div>
          </>
        ) : (
          <div className="text-center text-slate-400">Loading...</div>
        )}
        {progressModal}
      </div>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 px-6 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] lg:px-8 lg:py-8">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_36%)]" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 text-xs uppercase tracking-[0.35em] text-sky-200/55">
                  Problem Workspace
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
                  Problem Bank Product Workspace
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 lg:text-base">
                  Execute claimed Problem Bank challenges, upload proof of work,
                  and prepare the team submission for admin review.
                </p>
                {workspace ? (
                  <div className="mt-5 flex flex-wrap gap-3 text-sm">
                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-sky-300">
                      {workspace.category}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                      {workspace.stage}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                      {workspaceSourceLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                      <Clock className="h-4 w-4 text-slate-500" />
                      Started {d(workspace.createdAt)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
                {canManageWorkspace ? (
                  <button
                    onClick={() => {
                      setHasAttemptedProgressSubmit(false);
                      setShowProgressModal(true);
                    }}
                    disabled={!workspace}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Progress
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-800 pt-6 lg:grid-cols-[minmax(0,1.4fr)_300px]">
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.32em] text-slate-500">
                    Current workspace
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {workspace?.title ??
                      (listQuery.isLoading
                        ? "Loading workspaces..."
                        : "No active workspace")}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Switch between claimed Problem Bank workspaces without
                    leaving the page.
                  </div>
                </div>

                {!projectId ? (
                  <div className="flex flex-wrap gap-3">
                    {workspaceOptions.map((item) => {
                      const isActive = item._id === selectedWorkspaceId;
                      return (
                        <button
                          key={item._id}
                          onClick={() => setSelectedWorkspaceId(item._id)}
                          className={`min-w-[220px] flex-1 rounded-2xl border px-4 py-3 text-left transition ${isActive ? "border-sky-500/40 bg-sky-500/12 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.15)]" : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-900"}`}
                        >
                          <div className="truncate font-semibold">
                            {item.title}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                            {item.claimedProblemId
                              ? "Problem Bank"
                              : "Independent Workspace"}
                          </div>
                        </button>
                      );
                    })}
                    {!listQuery.isLoading && workspaceOptions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900 px-4 py-5 text-sm text-slate-400">
                        No Problem Bank workspace exists yet. Start from the
                        Problem Bank to create one.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Focus
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  {nextMilestone}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Keep the workspace centered on the next deliverable. Progress
                  uploads and chat updates should push this milestone forward.
                </p>
                {workspace ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Completion</span>
                      <span className="font-semibold text-white">
                        {workspace.progressPercent || 0}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500"
                        style={{ width: `${workspace.progressPercent || 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {toast ? (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-sky-500/30 bg-slate-950 px-4 py-3 text-sm text-sky-100 shadow-xl">
            {toast}
          </div>
        ) : null}

        {!workspace && !listQuery.isLoading ? (
          <section className="rounded-[28px] border border-dashed border-slate-700 bg-slate-950 p-10 text-center">
            <Rocket className="mx-auto mb-4 h-10 w-10 text-slate-500" />
            <h2 className="text-2xl font-bold text-white">
              No workspace available yet
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Start a challenge from the Problem Bank to create the linked
              product workspace for that problem.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate("/problem-bank")}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-fuchsia-600 px-6 py-3 font-semibold text-white"
              >
                Open Problem Bank
              </button>
            </div>
          </section>
        ) : null}

        {workspace ? (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_340px]">
              <section className="rounded-[28px] border border-slate-800 bg-slate-900 p-6 lg:p-7">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      Delivery track
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Milestones
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Track one path from research to final delivery without
                      splitting it into separate cards.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Current target
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {nextMilestone}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {workspace.milestones.map((milestone) => (
                    <div
                      key={milestone._id}
                      className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 md:grid-cols-[44px_minmax(0,1fr)_64px] md:items-center"
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${milestone.isCompleted ? "bg-emerald-500/12" : milestone.completionPercent > 0 ? "bg-sky-500/12" : "bg-slate-800"}`}
                      >
                        {milestone.isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Circle
                            className={`h-5 w-5 ${milestone.completionPercent > 0 ? "text-sky-400" : "text-slate-600"}`}
                          />
                        )}
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-white">
                            {milestone.name}
                          </h3>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {milestone.isCompleted ? "Complete" : "In progress"}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full transition-all ${milestone.isCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-fuchsia-500"}`}
                            style={{ width: `${milestone.completionPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right text-lg font-semibold text-white">
                        {milestone.completionPercent}%
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-800 bg-slate-900 p-6">
                  <h3 className="font-bold text-white">Project Stats</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-950 p-4 text-center">
                      <div className="text-2xl font-bold text-white">
                        {completedTaskCount}
                      </div>
                      <div className="text-xs text-slate-400">Tasks Done</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950 p-4 text-center">
                      <div className="text-2xl font-bold text-white">
                        {openTaskCount}
                      </div>
                      <div className="text-xs text-slate-400">Open Tasks</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950 p-4 text-center">
                      <div className="text-2xl font-bold text-white">
                        {teamMembers.length}
                      </div>
                      <div className="text-xs text-slate-400">Team Members</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950 p-4 text-center">
                      <div className="text-2xl font-bold text-white">
                        {evidenceCount}
                      </div>
                      <div className="text-xs text-slate-400">Docs</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-800 bg-slate-900 p-6">
                  <h3 className="font-bold text-white">Recent Updates</h3>
                  <div className="mt-4 space-y-3">
                    {recentUpdates.length > 0 ? (
                      recentUpdates.map((update) => {
                        const author = teamMembers.find(
                          (member) => member._id === update.submittedBy,
                        );
                        return (
                          <div key={update._id} className="text-sm">
                            <div className="font-semibold text-white">
                              {author?.displayName ?? "Team member"}
                            </div>
                            <div className="text-slate-400">{update.note}</div>
                            <div className="text-xs text-slate-500">
                              {dt(update.submittedAt)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-slate-400">
                        Progress updates will appear here after your first upload.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

              <section
                className={`${
                  activeTab === "chat"
                    ? "bg-transparent p-0"
                    : "rounded-[28px] border border-slate-800 bg-slate-900 p-4 lg:p-6"
                }`}
              >
                <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      Workbench
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Chat
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      One conversation now handles updates, docs, task capture, and collaboration mentions.
                    </p>
                  </div>
                </div>

                <div className={activeTab === "chat" ? "pt-0" : "pt-6"}>
                  {activeTab === "tasks" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                          {completedTaskCount} completed, {openTaskCount} open
                        </div>
                        {canManageWorkspace ? (
                          <button
                            onClick={() => setShowTaskForm((value) => !value)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Add Task
                          </button>
                        ) : null}
                      </div>
                      {taskFormPanel}
                      {(workspace.tasks ?? []).map((task) => (
                        <div
                          key={task._id}
                          className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4"
                        >
                          <button
                            onClick={() =>
                              toggleTask.mutate({
                                taskId: task._id,
                                done: !task.done,
                              })
                            }
                            disabled={!canManageWorkspace}
                            className={
                              task.done
                                ? "text-emerald-400 disabled:cursor-default"
                                : "text-slate-500 hover:text-sky-400 disabled:cursor-default disabled:hover:text-slate-500"
                            }
                          >
                            {task.done ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-semibold ${task.done ? "text-slate-500 line-through" : "text-white"}`}
                            >
                              {task.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {task.priority} priority • Due {d(task.dueDate)}
                            </div>
                          </div>
                          {canManageWorkspace ? (
                            <button
                              onClick={() => deleteTask.mutate(task._id)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {activeTab === "team" ? (
                    <div className="space-y-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-200">
                            {teamMembers.length} team member
                            {teamMembers.length === 1 ? "" : "s"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {pendingInvites.length > 0
                              ? `${pendingInvites.length} pending invite${pendingInvites.length === 1 ? "" : "s"}`
                              : "Invite student collaborators into this workspace."}
                          </div>
                        </div>
                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => setShowInviteForm((value) => !value)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                              showInviteForm
                                ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                                : "border-slate-700 bg-slate-950 text-white hover:border-slate-500"
                            }`}
                          >
                            <UserPlus className="h-4 w-4" />
                            {showInviteForm ? "Close Invite" : "Invite Teammate"}
                          </button>
                        ) : null}
                      </div>

                      {showInviteForm ? (
                        <div className="border-y border-slate-800 py-4">
                          <div className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                            Send Invite
                          </div>
                          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_180px]">
                            <input
                              value={inviteEmail}
                              onChange={(event) =>
                                setInviteEmail(event.target.value)
                              }
                              placeholder="student@college.edu"
                              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400"
                            />
                            <select
                              value={inviteRole}
                              onChange={(event) =>
                                setInviteRole(
                                  event.target.value as typeof inviteRole,
                                )
                              }
                              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400"
                            >
                              <option value="developer">Developer</option>
                              <option value="designer">Designer</option>
                              <option value="researcher">Researcher</option>
                              <option value="marketer">Marketer</option>
                              <option value="lead">Lead</option>
                              <option value="other">Other</option>
                            </select>
                            <input
                              value={inviteMessage}
                              onChange={(event) =>
                                setInviteMessage(event.target.value)
                              }
                              placeholder="Short note, ownership, or onboarding context"
                              className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400 xl:col-span-2"
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs leading-5 text-slate-500">
                              Workspace invites are limited to student
                              collaborators. Use chat access for mentor or
                              investor participation.
                            </div>
                            <button
                              type="button"
                              onClick={() => invite.mutate()}
                              disabled={!inviteEmail.trim() || invite.isPending}
                              className="inline-flex min-w-[132px] items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {invite.isPending ? "Sending..." : "Send Invite"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {pendingInvites.length > 0 ? (
                        <div className="space-y-2 border-b border-slate-800 pb-4">
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Pending
                          </div>
                          {pendingInvites.map((pendingInvite) => (
                            <div
                              key={pendingInvite._id}
                              className="flex flex-col gap-1.5 rounded-2xl bg-slate-950 px-4 py-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {pendingInvite.displayName ||
                                    pendingInvite.email ||
                                    "Pending teammate"}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {pendingInvite.email ?? "No email"}{" "}
                                  <span className="text-slate-600">/</span>{" "}
                                  {pendingInvite.proposedRole}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500">
                                Sent {dt(pendingInvite.createdAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="divide-y divide-slate-800/70 overflow-hidden rounded-[26px] border border-slate-800 bg-slate-950">
                        {teamMembers.map((member) => (
                          <div
                            key={member._id}
                            className="flex items-center gap-3 px-4 py-4"
                          >
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-bold text-white">
                              {member.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt={member.displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                initials(member.displayName)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">
                                {member.displayName}
                              </div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                {member.role}
                              </div>
                            </div>
                            {isOwner && member._id !== workspace.ownerId ? (
                              <button
                                type="button"
                                onClick={() => removeMember.mutate(member._id)}
                                className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-500/40 hover:text-rose-200"
                              >
                                Remove
                              </button>
                            ) : (
                              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {member._id === workspace.ownerId
                                  ? "Owner"
                                  : "Member"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "uploads" ? (
                    <div className="space-y-4">
                      {canManageWorkspace ? (
                        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-2">
                          <div className="space-y-3">
                            <select
                              value={uploadCategory}
                              onChange={(event) =>
                                setUploadCategory(
                                  event.target.value as WorkspaceUploadCategory,
                                )
                              }
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            >
                              <option value="other">Other</option>
                              <option value="bug_report">Bug report</option>
                              <option value="error_log">Error log</option>
                              <option value="screenshot">Screenshot</option>
                              <option value="test_result">Test result</option>
                              <option value="design_mockup">
                                Design mockup
                              </option>
                            </select>
                            <input
                              value={uploadNote}
                              onChange={(event) =>
                                setUploadNote(event.target.value)
                              }
                              placeholder="Upload note"
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            />
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-300">
                              <Upload className="h-4 w-4" />
                              Upload any file (PDF, Word, Excel, PowerPoint,
                              Image, Video, etc.)
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.mov,.avi,.webm,.mp3,.wav,.ogg"
                                className="hidden"
                                onChange={(event) =>
                                  void onFile(event.target.files?.[0] ?? null)
                                }
                              />
                            </label>
                          </div>
                          <div className="space-y-3">
                            <input
                              value={repoForm.repoUrl}
                              onChange={(event) =>
                                setRepoForm((current) => ({
                                  ...current,
                                  repoUrl: event.target.value,
                                }))
                              }
                              placeholder="GitHub repository URL"
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            />
                            <button
                              onClick={() => addRepo.mutate()}
                              disabled={
                                !repoForm.repoUrl.trim() || addRepo.isPending
                              }
                              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Attach Repository
                            </button>
                            <input
                              value={codeForm.title}
                              onChange={(event) =>
                                setCodeForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="Snippet title"
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            />
                            <textarea
                              value={codeForm.codeSnippet}
                              onChange={(event) =>
                                setCodeForm((current) => ({
                                  ...current,
                                  codeSnippet: event.target.value,
                                }))
                              }
                              placeholder="Paste a code snippet"
                              className="min-h-28 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            />
                            <button
                              onClick={() => addCode.mutate()}
                              disabled={
                                !codeForm.title.trim() ||
                                !codeForm.codeSnippet.trim() ||
                                addCode.isPending
                              }
                              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Save Code Snippet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                          Student collaborators manage docs and code records.
                          Mentor and investor access is read-only here.
                        </div>
                      )}
                      <div className="space-y-3">
                        {(workspace.uploads ?? []).map((upload) => (
                          <div
                            key={upload._id}
                            className="flex flex-col gap-4 rounded-[24px] border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0 flex items-start gap-3">
                              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-slate-300">
                                {getAttachmentIcon(upload.fileType)}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {upload.fileName}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {String(upload.fileType).toUpperCase()} /{" "}
                                  {formatFileSize(upload.fileSizeBytes)} /{" "}
                                  {upload.category ?? "other"} /{" "}
                                  {dt(upload.uploadedAt)}
                                </div>
                                {upload.note ? (
                                  <div className="mt-2 text-sm text-slate-400">
                                    {upload.note}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              {isInlinePreviewableFileType(upload.fileType) ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedUpload(upload)}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Preview
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openFileInNewTab(upload.fileUrl)}
                                className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Open
                              </button>
                              {canManageWorkspace ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteUpload.mutate(upload._id)
                                  }
                                  className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-500/40 hover:text-rose-200"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {(workspace.repoSubmissions ?? []).map((repo) => (
                          <div
                            key={repo._id}
                            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-white">
                                {repo.displayName}
                              </div>
                              <div className="text-xs text-slate-500">
                                GitHub • {dt(repo.uploadedAt)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={repo.repoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
                              >
                                Open
                              </a>
                              {canManageWorkspace ? (
                                <button
                                  onClick={() => deleteRepo.mutate(repo._id)}
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {(workspace.codeSubmissions ?? []).map((snippet) => (
                          <div
                            key={snippet._id}
                            className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="font-semibold text-white">
                                {snippet.title}
                              </div>
                              {canManageWorkspace ? (
                                <button
                                  onClick={() => deleteCode.mutate(snippet._id)}
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-200">
                              <code>{snippet.codeSnippet}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "chat" ? chatPanel : null}
                  {false && activeTab === "chat" ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                          Team chat and invited mentor/investor participants
                        </div>
                        <button
                          onClick={() =>
                            setShowNegotiationPanel((value) => !value)
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-200"
                        >
                          <Users2 className="h-4 w-4" />
                          Chat Access
                        </button>
                      </div>
                      <div className="overflow-hidden bg-transparent">
                        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 text-sm font-bold text-white">
                              {primaryChatParticipant?.avatar ? (
                                <img
                                  src={primaryChatParticipant.avatar}
                                  alt={primaryChatParticipant.displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                initials(
                                  primaryChatParticipant?.displayName ??
                                    workspace?.title ?? "",
                                )
                              )}
                              {onlineChatParticipants.length > 0 ? (
                                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#202c33] bg-emerald-400" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {workspace?.title}
                              </div>
                              <div className="truncate text-xs text-slate-300">
                                {typingLabel ??
                                  (onlineChatParticipants.length > 0
                                    ? `${onlineChatParticipants.length} participant${onlineChatParticipants.length > 1 ? "s" : ""} online`
                                    : "Offline right now")}
                              </div>
                            </div>
                          </div>
                        </div>

<div
                          ref={chatScrollerRef}
                          className="h-[420px] overflow-y-auto bg-[#0d0d0d] px-3 py-3 md:px-4"
                        >
                          <div className="space-y-1">
                            {chat.messages.length === 0 ? (
                              <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm text-slate-300 shadow-sm">
                                Start the thread with an update, an image, a
                                document, or a code snippet.
                              </div>
                            ) : null}

                            {chat.messages.map((message) => {
                              const sender =
                                teamMembers.find(
                                  (member) => member._id === message.senderId,
                                ) ??
                                (workspace?.chatParticipants ?? []).find(
                                  (participant) =>
                                    participant.userId === message.senderId,
                                );
                              const isOwn =
                                message.senderId === currentUser?._id;
                              const messageState = chat.messageStatus.get(
                                message._id,
                              );
                              const deliveredAt =
                                messageState?.deliveredAt ??
                                message.deliveredAt;
                              const seenBy =
                                messageState?.seenBy ?? message.seenBy ?? [];
                              const seenByOthers = seenBy.filter(
                                (userId) => userId !== currentUser?._id,
                              );
                              const seenByNames = seenByOthers
                                .map(
                                  (userId) =>
                                    chatRoster.find(
                                      (member) => member._id === userId,
                                    )?.displayName ?? "Member",
                                )
                                .filter(Boolean);
                              const attachment = getChatAttachment(message);
                              const isSeen = seenByOthers.length > 0;

                              return (
                                <div
                                  key={message._id}
                                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 md:max-w-[70%] ${isOwn ? "bg-emerald-700 text-white" : "bg-slate-800 text-white"}`}
                                  >
                                    {!isOwn ? (
                                      <div className="mb-0.5 text-xs font-medium text-cyan-400">
                                        {sender?.displayName ?? "Member"}
                                      </div>
                                    ) : null}

                                    {attachment?.fileType === "image" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openFileInNewTab(attachment.fileUrl)
                                        }
                                        className="mb-2 block overflow-hidden rounded-2xl bg-slate-900"
                                      >
                                        <img
                                          src={attachment.fileUrl}
                                          alt={attachment.fileName}
                                          className="max-h-72 w-full object-cover"
                                        />
                                      </button>
                                    ) : null}

                                    {attachment &&
                                    attachment.fileType !== "image" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openFileInNewTab(attachment.fileUrl)
                                        }
                                        className={`mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${isOwn ? "bg-emerald-800 hover:bg-emerald-600" : "bg-slate-700 hover:bg-slate-600"}`}
                                      >
                                        <div
                                          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isOwn ? "bg-sky-950 text-sky-200" : "bg-slate-950 text-slate-300"}`}
                                        >
                                          {getAttachmentIcon(
                                            attachment.fileType,
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div
                                            className={`truncate text-sm font-semibold ${isOwn ? "text-sky-50" : "text-white"}`}
                                          >
                                            {attachment.fileName}
                                          </div>
                                          <div
                                            className={`text-xs ${isOwn ? "text-sky-200/80" : "text-slate-400"}`}
                                          >
                                            {String(
                                              attachment.fileType,
                                            ).toUpperCase()}{" "}
                                            •{" "}
                                            {formatFileSize(
                                              attachment.fileSizeBytes,
                                            )}
                                          </div>
                                        </div>
                                        <Download
                                          className={`h-4 w-4 ${isOwn ? "text-sky-200/80" : "text-slate-400"}`}
                                        />
                                      </button>
                                    ) : null}

                                    {message.codeSnippet?.code ? (
                                      <div className="mb-2 overflow-hidden rounded-2xl border border-[#d1d7db] bg-[#111b21] text-white">
                                        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                                          <div className="flex items-center gap-2">
                                            <FileCode2 className="h-4 w-4" />
                                            {message.codeSnippet.title}
                                          </div>
                                          <span>
                                            {message.codeSnippet.language}
                                          </span>
                                        </div>
                                        <pre className="max-h-64 overflow-auto px-3 py-3 text-xs leading-6 text-slate-100">
                                          <code>
                                            {message.codeSnippet.code}
                                          </code>
                                        </pre>
                                      </div>
                                    ) : null}

                                    {message.message ? (
                                      <p className="whitespace-pre-wrap break-words text-[14px] leading-6">
                                        {message.message}
                                      </p>
                                    ) : null}

<div
                                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isOwn ? "text-white/70" : "text-slate-400"}`}
                                    >
                                      <span>{dt(message.sentAt)}</span>
                                      {isOwn && (
                                        isSeen ? (
                                          <span className="text-blue-400 font-medium">✓✓</span>
                                        ) : deliveredAt ? (
                                          <CheckCheck className="h-3 w-3" />
                                        ) : (
                                          <Check className="h-3 w-3" />
                                        )
                                      )}
                                    </div>

                                    {isOwn && seenByNames.length > 0 ? (
                                      <div className="mt-1 text-right text-[10px] text-blue-400">
                                        Seen by {seenByNames.join(", ")}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}

                            {typingLabel ? (
                              <div className="flex justify-start">
                                <div className="inline-flex items-center gap-3 rounded-[20px] bg-slate-800 px-3 py-2 text-xs text-slate-300">
                                  <div className="flex items-center gap-1">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.25s]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                                  </div>
                                  <span>{typingLabel}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="border-t border-slate-700 bg-[#1a1a1a] px-3 py-3 md:px-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {canManageWorkspace ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      imageAttachmentInputRef.current?.click()
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                                  >
                                    <ImagePlus className="h-3.5 w-3.5 text-sky-300" />
                                    Upload Image
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      docAttachmentInputRef.current?.click()
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:border-slate-500"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-cyan-300" />
                                    Upload Docs
                                  </button>
                                </>
                              ) : (
                                <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                                  File uploads are limited to workspace student
                                  collaborators.
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setChatComposerMode((current) =>
                                    current === "code" ? "text" : "code",
                                  )
                                }
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                  chatComposerMode === "code"
                                    ? "border-violet-400/40 bg-violet-500/10 text-violet-100"
                                    : "border-slate-700 bg-slate-900 text-white hover:border-slate-500"
                                }`}
                              >
                                <Code2 className="h-3.5 w-3.5 text-violet-300" />
                                Upload Code
                              </button>
                            </div>

                            {chatComposerMode === "code" ? (
                              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-white">
                                    Send code safely as plain text
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setChatComposerMode("text");
                                      setChatCodeSnippet({
                                        title: "",
                                        language: "typescript",
                                        code: "",
                                      });
                                    }}
                                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                                  <input
                                    value={chatCodeSnippet.title}
                                    onChange={(event) => {
                                      setChatCodeSnippet((current) => ({
                                        ...current,
                                        title: event.target.value,
                                      }));
                                      chat.sendTyping();
                                    }}
                                    placeholder="Snippet title"
                                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                                  />
                                  <input
                                    value={chatCodeSnippet.language}
                                    onChange={(event) => {
                                      setChatCodeSnippet((current) => ({
                                        ...current,
                                        language: event.target.value,
                                      }));
                                      chat.sendTyping();
                                    }}
                                    placeholder="Language"
                                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                                  />
                                </div>
                                <textarea
                                  value={chatCodeSnippet.code}
                                  onChange={(event) => {
                                    setChatCodeSnippet((current) => ({
                                      ...current,
                                      code: event.target.value,
                                    }));
                                    chat.sendTyping();
                                  }}
                                  placeholder="Paste code here. It is stored as plain text only and never executed on the server."
                                  className="mt-3 min-h-40 w-full rounded-2xl border border-slate-700 bg-[#111b21] px-4 py-3 font-mono text-xs text-slate-100 placeholder:text-slate-500"
                                />
                              </div>
                            ) : null}

                            {chatAttachment || chatCodeSnippet.code.trim() ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {chatAttachment ? (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                    {getAttachmentIcon(
                                    chatAttachment?.type.startsWith("image/")
                                      ? "image"
                                      : "doc",
                                    )}
                                    <span>{chatAttachment?.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => setChatAttachment(null)}
                                      className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : null}
                                {chatCodeSnippet.code.trim() ? (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                    <FileCode2 className="h-3.5 w-3.5 text-violet-300" />
                                    <span>
                                      {chatCodeSnippet.title.trim() ||
                                        "Code snippet ready"}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            <div className="flex items-end gap-2">
                              <div className="flex-1 rounded-[26px] bg-[#2a3942] px-4 py-2.5">
                                <textarea
                                  value={chatDraft}
                                  onChange={(event) => {
                                    setChatDraft(event.target.value);
                                    chat.sendTyping();
                                  }}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" &&
                                      !event.shiftKey
                                    ) {
                                      event.preventDefault();
                                      void sendMessage();
                                    }
                                  }}
                                  placeholder={
                                    chatComposerMode === "code"
                                      ? "Add a caption for this code snippet..."
                                      : "Type a message"
                                  }
                                  className="max-h-28 min-h-[28px] w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => void sendMessage()}
                                disabled={
                                  isSendingChat ||
                                  (!chatDraft.trim() &&
                                    !chatAttachment &&
                                    !chatCodeSnippet.code.trim())
                                }
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                {isSendingChat ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </button>
                            </div>

                            <input
                              ref={imageAttachmentInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                onChatAttachmentFile(
                                  event.target.files?.[0] ?? null,
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                            <input
                              ref={docAttachmentInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                              className="hidden"
                              onChange={(event) => {
                                onChatAttachmentFile(
                                  event.target.files?.[0] ?? null,
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="hidden">
                        {chat.messages.map((message) => {
                          const sender =
                            teamMembers.find(
                              (member) => member._id === message.senderId,
                            ) ??
                            (workspace?.chatParticipants ?? []).find(
                              (participant) =>
                                participant.userId === message.senderId,
                            );
                          const isOwn = message.senderId === currentUser?._id;
                          return (
                            <div
                              key={message._id}
                              className={`rounded-2xl border p-3 ${isOwn ? "border-blue-500/20 bg-blue-600/15" : "border-slate-800 bg-slate-900"}`}
                            >
                              <div className="mb-1 text-xs text-slate-500">
                                {isOwn
                                  ? "You"
                                  : (sender?.displayName ?? "Member")}{" "}
                                • {dt(message.sentAt)}
                              </div>
                              {message.message ? (
                                <div className="text-sm text-slate-200">
                                  {message.message}
                                </div>
                              ) : null}
                              {message.attachmentUrl ? (
                                <a
                                  href={message.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex text-xs text-sky-300"
                                >
                                  {message.attachmentType === "image"
                                    ? "Open image"
                                    : "Open PDF"}
                                </a>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <textarea
                        value={chatDraft}
                        onChange={(event) => {
                          setChatDraft(event.target.value);
                          chat.sendTyping();
                        }}
                        placeholder="Share an update with your team..."
                        className="hidden min-h-24 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                      />
                      <div className="hidden flex-wrap items-center gap-3">
                        {canManageWorkspace ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                            <Paperclip className="h-4 w-4" />
                            Attach Image/PDF
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(event) =>
                                setChatAttachment(
                                  event.target.files?.[0] ?? null,
                                )
                              }
                            />
                          </label>
                        ) : null}
                        {chatAttachment ? (
                          <span className="text-sm text-slate-400">
                            {chatAttachment?.name}
                          </span>
                        ) : null}
                        <button
                          onClick={() => void sendMessage()}
                          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </button>
                      </div>
                      {showNegotiationPanel ? (
                        <div className="space-y-3 rounded-2xl border border-amber-800/30 bg-amber-950/10 p-4">
                          <div className="text-xs text-amber-200">
                            Investor participants can be invited here for
                            chat-only access. Mentor coverage is assigned and
                            removed by admins from the mentorship workspace.
                          </div>
                          {(workspace?.chatParticipants ?? []).map(
                            (participant) => (
                              <div
                                key={participant._id}
                                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {participant.displayName ??
                                      participant.userId}
                                  </div>
                                  <div className="text-xs capitalize text-slate-400">
                                    {participant.role}
                                  </div>
                                </div>
                                {canManageChatAccess &&
                                participant.role !== "mentor" ? (
                                  <button
                                    onClick={() =>
                                      removeParticipant.mutate(
                                        participant.userId,
                                      )
                                    }
                                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
                                  >
                                    Remove
                                  </button>
                                ) : participant.role === "mentor" ? (
                                  <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200">
                                    Admin managed
                                  </span>
                                ) : null}
                              </div>
                            ),
                          )}
                          {canManageChatAccess ? (
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                value={participantForm.email}
                                onChange={(event) =>
                                  setParticipantForm((current) => ({
                                    ...current,
                                    email: event.target.value,
                                  }))
                                }
                                placeholder="investor@example.com"
                                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                              />
                              <button
                                onClick={() => addParticipant.mutate()}
                                disabled={
                                  !participantForm.email.trim() ||
                                  addParticipant.isPending
                                }
                                className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                Add Investor
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-[28px] border border-cyan-500/20 bg-cyan-500/10 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-cyan-200" />
                  <div>
                    <h3 className="font-bold text-white">Workspace Policy</h3>
                    <p className="mt-2 text-sm leading-6 text-cyan-100">
                      Product Workspace is reserved for Problem Bank challenge
                      delivery and leaderboard progress. Use Startup Launch for
                      startup drafts, investor launch, and patent support.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {progressModal}
      </div>

      <FileViewerModal
        upload={selectedUpload}
        onClose={() => setSelectedUpload(null)}
      />
    </DashboardLayout>
  );
}

export function ProductWorkspace() {
  const { projectId } = useParams();
  const currentUser = useAuthStore((state) => state.user);

  if (!projectId && currentUser?.role === UserRole.STUDENT) {
    return <ProductWorkspaceManager />;
  }

  return <ProductWorkspaceDetail />;
}

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
import { FileViewerModal } from "../../components/file-viewer/FileViewerModal";

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

export function ProductWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState("tasks");
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
  const [chatComposerMode, setChatComposerMode] = useState<"text" | "code">(
    "text",
  );
  const [showChatAttachmentMenu, setShowChatAttachmentMenu] = useState(false);
  const [chatCodeSnippet, setChatCodeSnippet] = useState({
    title: "",
    language: "typescript",
    code: "",
  });
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [progressForm, setProgressForm] = useState({
    note: "",
    milestoneRef: "",
    completionPercent: "",
    file: null as File | null,
  });
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
  const chatScrollerRef = useRef<HTMLDivElement | null>(null);
  const imageAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const docAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  const listQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
  });
  const problemBankWorkspaceOptions = useMemo(
    () =>
      (listQuery.data ?? []).filter((item) => Boolean(item.claimedProblemId)),
    [listQuery.data],
  );
  const workspaceId = projectId || selectedWorkspaceId || undefined;
  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getById(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const workspace = workspaceQuery.data;
  const teamMembers = workspace?.teamMembers ?? [];
  const isOwner = workspace?.ownerId === currentUser?._id;
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
    onSuccess: refresh,
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
      setProgressForm({
        note: "",
        milestoneRef: "",
        completionPercent: "",
        file: null,
      });
      setShowProgressModal(false);
      setToast("Progress uploaded! Your Innovation Score is being updated...");
      await refresh();
    },
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      return setToast("File size must be 10MB or less.");
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      return setToast("Only PDF and image files are allowed");
    }

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
    setShowChatAttachmentMenu(false);
  };

  const sendMessage = async () => {
    if (!workspaceId) return;

    const normalizedMessage = chatDraft.trim();
    const normalizedCode =
      chatComposerMode === "code"
        ? {
            title: chatCodeSnippet.title.trim(),
            language: chatCodeSnippet.language.trim(),
            code: chatCodeSnippet.code.trim(),
          }
        : null;

    if (!normalizedMessage && !chatAttachment && !normalizedCode?.code) {
      return;
    }

    if (
      normalizedCode?.code &&
      (!normalizedCode.title || !normalizedCode.language)
    ) {
      setToast("Add a code title and language before sending.");
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
        ...(normalizedCode?.code
          ? {
              codeSnippet: {
                title: normalizedCode.title,
                language: normalizedCode.language,
                code: normalizedCode.code,
                lineCount: normalizedCode.code.split(/\r\n|\r|\n/).length,
              },
            }
          : {}),
      });
      setChatDraft("");
      setChatAttachment(null);
      setChatComposerMode("text");
      setChatCodeSnippet({
        title: "",
        language: "typescript",
        code: "",
      });
      setShowChatAttachmentMenu(false);
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
  const chatRoster = workspace
    ? [
        ...teamMembers,
        ...(workspace.chatParticipants ?? []).map((participant) => ({
          _id: participant.userId,
          displayName: participant.displayName ?? participant.userId,
          avatar: participant.avatar ?? undefined,
        })),
      ]
    : [];
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

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-800/80 bg-slate-950 px-6 py-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] lg:px-8 lg:py-8">
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
                    <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-slate-300">
                      {workspaceSourceLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-slate-300">
                      <Clock className="h-4 w-4 text-slate-500" />
                      Started {d(workspace.createdAt)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
                {canManageWorkspace ? (
                  <button
                    onClick={() => setShowProgressModal(true)}
                    disabled={!workspace}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Progress
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-800/80 pt-6 lg:grid-cols-[minmax(0,1.4fr)_300px]">
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
                          className={`min-w-[220px] flex-1 rounded-2xl border px-4 py-3 text-left transition ${isActive ? "border-sky-500/40 bg-sky-500/12 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.15)]" : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900"}`}
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
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
                        No Problem Bank workspace exists yet. Start from the
                        Problem Bank to create one.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
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
          <section className="rounded-[28px] border border-dashed border-slate-700 bg-slate-950/90 p-10 text-center">
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_340px]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 lg:p-7">
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
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-right">
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
                      className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 px-4 py-4 md:grid-cols-[44px_minmax(0,1fr)_64px] md:items-center"
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

              <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-4 lg:p-6">
                <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      Workbench
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {activeTab === "tasks"
                        ? "Tasks"
                        : activeTab === "team"
                          ? "Team"
                          : activeTab === "uploads"
                            ? "Docs"
                            : "Chat"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Work on one stream at a time and keep the rest of the page
                      quiet.
                    </p>
                  </div>
                  <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1.5">
                    {["tasks", "team", "uploads", "chat"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab ? "bg-gradient-to-r from-blue-600 to-fuchsia-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        {tab === "uploads"
                          ? "Docs"
                          : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
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
                      {showTaskForm && canManageWorkspace ? (
                        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-2">
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
                                priority: event.target
                                  .value as WorkspaceTask["priority"],
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
                              disabled={
                                !taskForm.title.trim() || addTask.isPending
                              }
                              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {addTask.isPending ? "Saving..." : "Save Task"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {(workspace.tasks ?? []).map((task) => (
                        <div
                          key={task._id}
                          className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
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
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                          {teamMembers.length} team members
                        </div>
                        {isOwner ? (
                          <button
                            onClick={() => setShowInviteForm((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            <UserPlus className="h-4 w-4" />
                            Invite
                          </button>
                        ) : null}
                      </div>
                      {showInviteForm ? (
                        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="text-xs leading-5 text-slate-500">
                            Team invites are for student collaborators only. Use
                            chat access for mentor and investor collaboration.
                          </div>
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                            <input
                              value={inviteEmail}
                              onChange={(event) =>
                                setInviteEmail(event.target.value)
                              }
                              placeholder="Enter student teammate email"
                              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                            />
                            <select
                              value={inviteRole}
                              onChange={(event) =>
                                setInviteRole(
                                  event.target.value as typeof inviteRole,
                                )
                              }
                              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white"
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
                              placeholder="Message or access details"
                              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white lg:col-span-2"
                            />
                            <button
                              onClick={() => invite.mutate()}
                              disabled={!inviteEmail.trim() || invite.isPending}
                              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member._id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-fuchsia-500 text-sm font-bold text-white">
                              {member.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt={member.displayName}
                                  className="h-10 w-10 rounded-2xl object-cover"
                                />
                              ) : (
                                initials(member.displayName)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold text-white">
                                {member.displayName}
                              </div>
                              <div className="text-sm text-slate-400">
                                {member.role}
                              </div>
                            </div>
                            {isOwner && member._id !== workspace.ownerId ? (
                              <button
                                onClick={() => removeMember.mutate(member._id)}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "uploads" ? (
                    <div className="space-y-4">
                      {canManageWorkspace ? (
                        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-2">
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
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                          Student collaborators manage docs and code records.
                          Mentor and investor access is read-only here.
                        </div>
                      )}
                      <div className="space-y-3">
                        {(workspace.uploads ?? []).map((upload) => (
                          <div
                            key={upload._id}
                            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setSelectedUpload(upload)}
                                className="text-left hover:text-cyan-400"
                              >
                                <div className="font-semibold text-white">
                                  {upload.fileName}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {upload.category ?? "other"} •{" "}
                                  {dt(upload.uploadedAt)}
                                </div>
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedUpload(upload)}
                                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
                              >
                                Open
                              </button>
                              {canManageWorkspace ? (
                                <button
                                  onClick={() =>
                                    deleteUpload.mutate(upload._id)
                                  }
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
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
                            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
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
                            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
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

                  {activeTab === "chat" ? (
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
                        <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-900/70 px-4 py-3">
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
                                    workspace.title,
                                )
                              )}
                              {onlineChatParticipants.length > 0 ? (
                                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#202c33] bg-emerald-400" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {workspace.title}
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
                          className="h-[420px] overflow-y-auto bg-[#111827] bg-[radial-gradient(circle_at_25px_25px,rgba(148,163,184,0.07)_1.5px,transparent_0),radial-gradient(circle_at_75px_75px,rgba(15,23,42,0.48)_2px,transparent_0)] bg-[length:100px_100px] px-3 py-4 md:px-5"
                        >
                          <div className="space-y-2.5">
                            {chat.messages.length === 0 ? (
                              <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-[#1f2937]/95 px-4 py-3 text-center text-sm text-slate-300 shadow-sm">
                                Start the thread with an update, an image, a
                                document, or a code snippet.
                              </div>
                            ) : null}

                            {chat.messages.map((message) => {
                              const sender =
                                teamMembers.find(
                                  (member) => member._id === message.senderId,
                                ) ??
                                (workspace.chatParticipants ?? []).find(
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
                              const receiptIcon =
                                seenByOthers.length > 0 ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                                ) : deliveredAt ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-slate-500" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-slate-500" />
                                );

                              return (
                                <div
                                  key={message._id}
                                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-[18px] border px-3 py-2 shadow-sm md:max-w-[72%] ${isOwn ? "border-emerald-900/60 bg-[#144d3f] text-[#eafff7]" : "border-slate-700 bg-[#1f2937] text-slate-100"}`}
                                  >
                                    {!isOwn ? (
                                      <div className="mb-1 text-[11px] font-semibold text-slate-400">
                                        {sender?.displayName ?? "Member"}
                                      </div>
                                    ) : null}

                                    {attachment?.fileType === "image" ? (
                                      <a
                                        href={attachment.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mb-2 block overflow-hidden rounded-2xl bg-slate-900"
                                      >
                                        <img
                                          src={attachment.fileUrl}
                                          alt={attachment.fileName}
                                          className="max-h-72 w-full object-cover"
                                        />
                                      </a>
                                    ) : null}

                                    {attachment &&
                                    attachment.fileType !== "image" ? (
                                      <a
                                        href={attachment.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`mb-2 flex items-center gap-3 rounded-2xl px-3 py-3 transition ${isOwn ? "bg-[#0e3b31] hover:bg-[#12473b]" : "bg-slate-800 hover:bg-slate-700"}`}
                                      >
                                        <div
                                          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isOwn ? "bg-emerald-950/70 text-emerald-200" : "bg-slate-900 text-slate-300"}`}
                                        >
                                          {getAttachmentIcon(
                                            attachment.fileType,
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div
                                            className={`truncate text-sm font-semibold ${isOwn ? "text-emerald-50" : "text-white"}`}
                                          >
                                            {attachment.fileName}
                                          </div>
                                          <div
                                            className={`text-xs ${isOwn ? "text-emerald-200/80" : "text-slate-400"}`}
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
                                          className={`h-4 w-4 ${isOwn ? "text-emerald-200/80" : "text-slate-400"}`}
                                        />
                                      </a>
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
                                      className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isOwn ? "text-emerald-100/70" : "text-slate-400"}`}
                                    >
                                      <span>{dt(message.sentAt)}</span>
                                      {isOwn ? receiptIcon : null}
                                    </div>

                                    {isOwn && seenByNames.length > 0 ? (
                                      <div className="mt-1 text-right text-[11px] text-sky-400">
                                        Seen by {seenByNames.join(", ")}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}

                            {typingLabel ? (
                              <div className="flex justify-start">
                                <div className="rounded-[18px] border border-slate-700 bg-[#1f2937] px-3 py-2 text-xs text-slate-300 shadow-sm">
                                  {typingLabel}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="border-t border-slate-800/70 bg-slate-900/70 px-3 py-3 md:px-4">
                          <div className="relative">
                            {showChatAttachmentMenu ? (
                              <div className="absolute bottom-[calc(100%+12px)] left-0 z-20 w-64 rounded-2xl border border-slate-700 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
                                {canManageWorkspace ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        imageAttachmentInputRef.current?.click()
                                      }
                                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-slate-800"
                                    >
                                      <ImagePlus className="h-4 w-4 text-emerald-300" />
                                      Image
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        docAttachmentInputRef.current?.click()
                                      }
                                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-slate-800"
                                    >
                                      <FileText className="h-4 w-4 text-cyan-300" />
                                      Document
                                    </button>
                                  </>
                                ) : (
                                  <div className="rounded-xl px-3 py-2 text-xs leading-5 text-slate-400">
                                    File uploads are limited to workspace
                                    student collaborators.
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setChatComposerMode("code");
                                    setShowChatAttachmentMenu(false);
                                  }}
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-slate-800"
                                >
                                  <Code2 className="h-4 w-4 text-violet-300" />
                                  Code snippet
                                </button>
                              </div>
                            ) : null}

                            {chatComposerMode === "code" ? (
                              <div className="mb-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
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
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                {chatAttachment ? (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs text-slate-200">
                                    {getAttachmentIcon(
                                      chatAttachment.type.startsWith("image/")
                                        ? "image"
                                        : "doc",
                                    )}
                                    <span>{chatAttachment.name}</span>
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
                              <button
                                type="button"
                                onClick={() =>
                                  setShowChatAttachmentMenu((value) => !value)
                                }
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2a3942] text-slate-200 transition hover:bg-[#31444f]"
                              >
                                <Plus className="h-5 w-5" />
                              </button>

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
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white transition hover:bg-[#06b48e] disabled:cursor-not-allowed disabled:bg-slate-700"
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
                            (workspace.chatParticipants ?? []).find(
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
                            {chatAttachment.name}
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
                          {(workspace.chatParticipants ?? []).map(
                            (participant) => (
                              <div
                                key={participant._id}
                                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
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
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6">
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

              <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6">
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

        {showProgressModal && workspace && canManageWorkspace ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Upload Progress
                </h2>
                <button
                  onClick={() => setShowProgressModal(false)}
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
                  className="min-h-32 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                />
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
                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white"
                  />
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
                    onClick={() => setShowProgressModal(false)}
                    className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => progress.mutate()}
                    disabled={!progressForm.note.trim() || progress.isPending}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {progress.isPending ? "Submitting..." : "Submit Progress"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <FileViewerModal
        upload={selectedUpload}
        onClose={() => setSelectedUpload(null)}
      />
    </DashboardLayout>
  );
}

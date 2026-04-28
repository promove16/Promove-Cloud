import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useParams } from "react-router-dom";
import { Check, CheckCheck, CheckCircle, Circle, FolderKanban, Link2, Send, Trash2 } from "lucide-react";
import type { WorkspaceTask } from "../../types/workspace.types";
import { Spinner } from "../../components/ui/Spinner";
import { startupApi } from "../../api/startup.api";
import { workspaceApi } from "../../api/workspace.api";
import { useAuthStore } from "../../store/authStore";
import { useWorkspaceChat } from "../../hooks/useWorkspaceChat";
import { toast } from "../../app/components/ui/sonner";
import { getApiErrorMessage } from "../../utils/apiError";
import { ProductWorkspaceDetail } from "../../app/pages/ProductWorkspace";

const d = (value?: string) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Not set";

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const getActionErrorMessage = (error: unknown, fallback: string) => {
  return getApiErrorMessage(error, error instanceof Error ? error.message : fallback);
};

export function StartupWorkspace() {
  const queryClient = useQueryClient();
  const { startupId: paramId } = useParams<{ startupId: string }>();
  const context = useOutletContext<{ startupId?: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const startupId = context?.startupId ?? paramId;

  const [activeTab, setActiveTab] = useState("chat");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "Medium" as WorkspaceTask["priority"], dueDate: "", assignedTo: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"developer" | "designer" | "researcher" | "marketer" | "lead" | "other">("other");
  const [chatDraft, setChatDraft] = useState("");
  const [chatAttachment, setChatAttachment] = useState<File | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [selectedExistingWorkspaceId, setSelectedExistingWorkspaceId] = useState("");
  const chatScrollerRef = useRef<HTMLDivElement | null>(null);

  const startupQuery = useQuery({ queryKey: ["startup", startupId], queryFn: () => startupApi.getById(startupId!), enabled: Boolean(startupId) });
  const startup = startupQuery.data;
  const workspaceId = startup?.projectId;
  const workspaceListQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
    enabled: Boolean(startupId),
  });

  const workspaceQuery = useQuery({ queryKey: ["workspace", workspaceId], queryFn: () => workspaceApi.getById(workspaceId!), enabled: Boolean(workspaceId) });
  const workspace = workspaceQuery.data;
  const teamMembers = workspace?.teamMembers ?? [];
  const isOwner = workspace?.ownerId === currentUser?._id;
  const canManageWorkspace = currentUser?.role === "student" && Boolean(workspace);
  const canEditStartupWorkspaceLink = Boolean(startup?.editAccess?.canEdit);
  const chat = useWorkspaceChat(workspaceId);
  const availableWorkspaceOptions = useMemo(
    () =>
      (workspaceListQuery.data ?? []).filter((item) => item._id !== startup?.projectId),
    [startup?.projectId, workspaceListQuery.data],
  );

  const chatRoster = workspace ? [...teamMembers, ...(workspace.chatParticipants ?? []).map((p) => ({ _id: p.userId, displayName: p.displayName ?? p.userId, avatar: p.avatar }))] : [];
  const onlineChatParticipants = chatRoster.filter((m) => chat.onlineUserIds.has(m._id) && m._id !== currentUser?._id);
  const typingNames = chatRoster.filter((m) => chat.typingUsers.has(m._id) && m._id !== currentUser?._id).map((m) => m.displayName);
  const primaryParticipant = onlineChatParticipants[0] ?? chatRoster.find((m) => m._id !== currentUser?._id);
  const typingLabel = typingNames.length === 0 ? null : typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames[0]} and ${typingNames.length - 1} more`;

  const nextMilestone = useMemo(() => workspace?.milestones.find((m) => !m.isCompleted)?.name ?? "Ready", [workspace?.milestones]);
  const completedTaskCount = (workspace?.tasks ?? []).filter((t) => t.done).length;
  const openTaskCount = (workspace?.tasks ?? []).filter((t) => !t.done).length;

  useEffect(() => {
    if (selectedExistingWorkspaceId && availableWorkspaceOptions.some((item) => item._id === selectedExistingWorkspaceId)) {
      return;
    }

    setSelectedExistingWorkspaceId(availableWorkspaceOptions[0]?._id ?? "");
  }, [availableWorkspaceOptions, selectedExistingWorkspaceId]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["startup", startupId] }),
      queryClient.invalidateQueries({ queryKey: ["startup"] }),
      queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ...(workspaceId ? [queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] })] : []),
    ]);
  };

  const createWorkspaceAndAttach = useMutation({
    mutationFn: async () => {
      if (!startupId || !startup) {
        throw new Error("Startup not found.");
      }

      if (!canEditStartupWorkspaceLink) {
        throw new Error(startup.editAccess?.reason || "This startup cannot be edited right now.");
      }

      const title = startup.name.trim() || "Startup Workspace";
      const category = startup.category.trim() || "Startup";
      const createdWorkspace = await workspaceApi.create({ title, category });
      await startupApi.update(startupId, { projectId: createdWorkspace._id });
      return createdWorkspace;
    },
    onSuccess: async (createdWorkspace) => {
      toast.success(`Workspace linked: ${createdWorkspace.title}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup", startupId] }),
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace", createdWorkspace._id] }),
      ]);
    },
    onError: (error) => {
      toast.error(getActionErrorMessage(error, "Unable to create a workspace right now."));
    },
  });

  const attachExistingWorkspace = useMutation({
    mutationFn: async () => {
      if (!startupId || !startup) {
        throw new Error("Startup not found.");
      }

      if (!selectedExistingWorkspaceId) {
        throw new Error("Select a workspace first.");
      }

      if (!canEditStartupWorkspaceLink) {
        throw new Error(startup.editAccess?.reason || "This startup cannot be edited right now.");
      }

      return startupApi.update(startupId, { projectId: selectedExistingWorkspaceId });
    },
    onSuccess: async (savedStartup) => {
      const linkedWorkspace = availableWorkspaceOptions.find((item) => item._id === savedStartup.projectId);
      toast.success(linkedWorkspace ? `Workspace linked: ${linkedWorkspace.title}` : "Workspace linked.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["startup", startupId] }),
        queryClient.invalidateQueries({ queryKey: ["startup"] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        ...(savedStartup.projectId ? [queryClient.invalidateQueries({ queryKey: ["workspace", savedStartup.projectId] })] : []),
      ]);
    },
    onError: (error) => {
      toast.error(getActionErrorMessage(error, "Unable to attach the selected workspace."));
    },
  });

  const addTask = useMutation({
    mutationFn: () => workspaceApi.addTask(workspaceId!, { 
      title: taskForm.title, 
      priority: taskForm.priority as any, 
      description: taskForm.description,
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined,
      assignedTo: taskForm.assignedTo || undefined,
    }),
    onSuccess: async () => {
      setTaskForm({ title: "", description: "", priority: "Medium", dueDate: "", assignedTo: "" });
      setShowTaskForm(false);
      toast.success("Task added.");
      await refresh();
    },
  });

  const toggleTask = useMutation({
    mutationFn: (payload: { taskId: string; done: boolean }) => workspaceApi.updateTask(workspaceId!, payload.taskId, { done: payload.done }),
    onSuccess: refresh,
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => workspaceApi.deleteTask(workspaceId!, taskId),
    onSuccess: async () => { toast.success("Task removed."); await refresh(); },
  });

  const invite = useMutation({
    mutationFn: () => workspaceApi.invite(workspaceId!, { email: inviteEmail, proposedRole: inviteRole }),
    onSuccess: async () => {
      setInviteEmail("");
      setInviteRole("other");
      toast.success("Invite sent.");
      await refresh();
    },
    onError: () => { 
      toast.error("Failed to invite.");
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => workspaceApi.removeMember(workspaceId!, userId),
    onSuccess: async () => { toast.success("Member removed."); await refresh(); },
  });

  const onChatFile = (file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) {
      toast.error("Max 10MB file.");
      return;
    }
    setChatAttachment(file);
  };

  const sendMessage = async () => {
    if (!workspaceId) return;
    const msg = chatDraft.trim();
    if (!msg && !chatAttachment) return;
    setIsSendingChat(true);
    try {
      let attachment: { attachmentUrl: string; attachmentType: "image" | "pdf" | "doc" | "ppt" | "xls"; attachmentName: string; attachmentSizeBytes: number; attachmentMimeType?: string; attachmentUploadId?: string } | undefined;
      if (chatAttachment) {
        const uploads = await workspaceApi.upload(workspaceId, chatAttachment, "Chat");
        const latest = uploads[uploads.length - 1];
        if (latest?.fileUrl) {
          attachment = { attachmentUrl: latest.fileUrl, attachmentType: latest.fileType as any, attachmentName: latest.fileName, attachmentSizeBytes: latest.fileSizeBytes, attachmentUploadId: latest._id };
        }
      }
      chat.sendMessage({ workspaceId, message: msg, ...(attachment ?? {}) });
      setChatDraft("");
      setChatAttachment(null);
    } catch (e) { 
      toast.error("Failed to send message.");
    } finally {
      setIsSendingChat(false);
    }
  };

  useEffect(() => {
    if (!currentUser?._id) return;
    chat.messages.forEach((m) => {
      if (m.senderId !== currentUser._id) {
        const s = chat.messageStatus.get(m._id);
        if (!s?.deliveredAt && !m.deliveredAt) chat.markDelivered(m._id);
      }
    });
  }, [chat]);

  useEffect(() => {
    if (activeTab !== "chat" || !currentUser?._id) return;
    chat.messages.forEach((m) => {
      if (m.senderId !== currentUser._id) {
        const s = chat.messageStatus.get(m._id);
        const seen = s?.seenBy ?? m.seenBy ?? [];
        if (!seen.includes(currentUser._id)) chat.markSeen(m._id);
      }
    });
  }, [activeTab, chat]);

  useEffect(() => {
    if (activeTab !== "chat" || !chatScrollerRef.current) return;
    chatScrollerRef.current.scrollTo({ top: chatScrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [activeTab, chat.messages.length]);

  if (!startupId || startupQuery.isLoading || workspaceQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  if (!startup) {
    return <div className="p-6 text-sm text-slate-400">Startup not found.</div>;
  }

  if (startup.projectId && workspace) {
    return (
      <ProductWorkspaceDetail
        projectIdOverride={startup.projectId}
        embedded
      />
    );
  }

  if (!startup?.projectId || !workspace) {
    const isBusy = createWorkspaceAndAttach.isPending || attachExistingWorkspace.isPending;
    const lockReason = startup.editAccess?.reason || "This startup cannot be edited right now.";
    const createBlockedReason = !canEditStartupWorkspaceLink
      ? lockReason
      : null;

    return (
      <div className="space-y-6 border border-slate-800 bg-slate-950 p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-300">
            <FolderKanban className="h-4 w-4" />
            Startup Workspace
          </div>
          <h1 className="text-2xl font-semibold text-white">No workspace linked to this startup yet</h1>
          <p className="text-sm text-slate-400">
            Create a dedicated execution workspace for <span className="font-semibold text-slate-200">{startup.name || "this startup"}</span>,
            or attach one of your existing workspaces and continue with chat, tasks, and team coordination here.
          </p>
          {!canEditStartupWorkspaceLink ? (
            <div className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Workspace linking is currently locked. {lockReason}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Create new</div>
            <h2 className="mt-3 text-lg font-semibold text-white">Create a startup workspace</h2>
            <p className="mt-2 text-sm text-slate-400">
              A new workspace will be created with the startup name and category, then linked automatically.
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-slate-400">Workspace title</span>
                <span className="font-medium text-white">{startup.name.trim() || "Startup Workspace"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Category</span>
                <span className="font-medium text-white">{startup.category.trim() || "Startup"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => createWorkspaceAndAttach.mutate()}
              disabled={!canEditStartupWorkspaceLink || isBusy}
              title={createBlockedReason ?? "Create a new workspace and link it to this startup"}
              className="mt-6 inline-flex items-center gap-2 bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FolderKanban className="h-4 w-4" />
              {createWorkspaceAndAttach.isPending ? "Creating..." : "Create And Link Workspace"}
            </button>
          </section>

          <section className="border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Attach existing</div>
            <h2 className="mt-3 text-lg font-semibold text-white">Link an existing workspace</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use this when the startup should continue inside a workspace you already created.
            </p>
            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-300">Available workspaces</label>
              <select
                value={selectedExistingWorkspaceId}
                onChange={(event) => setSelectedExistingWorkspaceId(event.target.value)}
                disabled={!canEditStartupWorkspaceLink || availableWorkspaceOptions.length === 0 || isBusy}
                className="w-full border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availableWorkspaceOptions.length === 0 ? (
                  <option value="">No other workspaces available</option>
                ) : (
                  availableWorkspaceOptions.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title} · {item.category} · {item.stage}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => attachExistingWorkspace.mutate()}
              disabled={!canEditStartupWorkspaceLink || !selectedExistingWorkspaceId || isBusy}
              className="mt-6 inline-flex items-center gap-2 border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" />
              {attachExistingWorkspace.isPending ? "Linking..." : "Link Selected Workspace"}
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{workspace.title}</h1>
          <p className="text-sm text-slate-400">{workspace.category} • {workspace.progressPercent}% complete</p>
        </div>
        <div className="flex gap-1 bg-slate-800 p-1">
          {["chat", "team", "tasks"].map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-1 text-sm ${activeTab === t ? "bg-blue-600 text-white" : "text-slate-400"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "chat" && (
        <div className="flex flex-col bg-[#0a0a0a] rounded-lg overflow-hidden border border-slate-800">
          <div className="flex items-center gap-3 border-b border-slate-700 px-3 py-2 bg-[#1a1a1a]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
              {primaryParticipant?.avatar ? <img src={primaryParticipant.avatar} className="h-9 w-9 rounded-full object-cover" /> : initials(primaryParticipant?.displayName ?? "WS")}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{workspace.title}</div>
              <div className="text-xs text-emerald-400">{typingLabel ?? (onlineChatParticipants.length > 0 ? `${onlineChatParticipants.length} online` : "Click to chat")}</div>
            </div>
          </div>
          
          <div ref={chatScrollerRef} className="h-[calc(100vh-320px)] min-h-64 overflow-y-auto p-3 space-y-1">
            {chat.messages.length === 0 && <div className="text-center text-sm text-slate-500 p-4">Start the conversation</div>}
            {chat.messages.map((m) => {
              const sender = teamMembers.find((tm) => tm._id === m.senderId) ?? workspace?.chatParticipants?.find((p) => p.userId === m.senderId);
              const isOwn = m.senderId === currentUser?._id;
              const s = chat.messageStatus.get(m._id);
              const delivered = s?.deliveredAt ?? m.deliveredAt;
              const seenBy = (s?.seenBy ?? m.seenBy ?? []).filter((u) => u !== currentUser?._id);
              const att = m.attachment ?? (m.attachmentUrl ? { fileUrl: m.attachmentUrl, fileType: m.attachmentType!, fileName: m.attachmentName ?? "File", fileSizeBytes: m.attachmentSizeBytes ?? 0 } : undefined);
              const isSeen = seenBy.length > 0;

              return (
                <div key={m._id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isOwn ? "bg-emerald-600" : "bg-slate-800"}`}>
                    {!isOwn && <div className="text-xs font-medium text-cyan-300 mb-1">{sender?.displayName}</div>}
                    {att?.fileType === "image" && <img src={att.fileUrl} className="max-h-48 rounded mb-1" />}
                    {att && att.fileType !== "image" && <a href={att.fileUrl} className="flex gap-2 text-xs text-cyan-300 mb-1">📎 {att.fileName}</a>}
                    {m.message && <p className="text-sm text-white whitespace-pre-wrap">{m.message}</p>}
                    <div className="text-[10px] text-right mt-1 flex items-center justify-end gap-1 text-slate-400">
                      <span>{d(m.sentAt).replace(",", "")}</span>
                      {isOwn && (
                        isSeen ? (
                          <span className="text-blue-400">✓✓</span>
                        ) : delivered ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingLabel && <div className="text-xs text-slate-500 p-2">{typingLabel}</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-700 p-2 bg-slate-900">
            <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => onChatFile(e.target.files?.[0] ?? null)} />
            <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Type a message..." className="flex-1 bg-slate-800 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-slate-500" />
            <button onClick={sendMessage} disabled={!chatDraft.trim() && !chatAttachment || isSendingChat} className="bg-emerald-600 hover:bg-emerald-500 p-2.5 rounded-full text-white disabled:opacity-50 transition">
              {isSendingChat ? "..." : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}

      {activeTab === "team" && (
        <div className="bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 p-3">
            <span className="text-sm text-slate-400">{teamMembers.length} members</span>
            {isOwner && <button onClick={() => invite.mutate()} className="bg-blue-600 px-3 py-1 text-sm text-white">Invite</button>}
          </div>
          <div className="p-2 space-y-2">
            {teamMembers.map((m) => (
              <div key={m._id} className="flex items-center gap-2 p-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-white">
                  {m.avatar ? <img src={m.avatar} className="h-8 w-8 rounded-full" /> : initials(m.displayName)}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white">{m.displayName}</div>
                  <div className="text-xs text-slate-500">{m.role}</div>
                </div>
                {isOwner && m._id !== workspace.ownerId && <button onClick={() => removeMember.mutate(m._id)} className="text-xs text-red-400">Remove</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 p-3">
            <span className="text-sm text-slate-400">{completedTaskCount}/{openTaskCount + completedTaskCount} done</span>
            {canManageWorkspace && <button onClick={() => setShowTaskForm(true)} className="bg-blue-600 px-3 py-1 text-sm text-white">Create Issue</button>}
          </div>
          {showTaskForm && canManageWorkspace && (
            <div className="border-b border-slate-800 p-3 space-y-2">
              <input value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} placeholder="Issue title" className="w-full bg-slate-800 px-3 py-2 text-sm text-white" />
              <textarea value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} placeholder="Description" className="w-full bg-slate-800 px-3 py-2 text-sm text-white h-20" />
              <div className="flex gap-2">
                <select value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value as any})} className="bg-slate-800 px-2 py-1 text-sm text-white">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})} className="bg-slate-800 px-2 py-1 text-sm text-white" />
                <select value={taskForm.assignedTo} onChange={(e) => setTaskForm({...taskForm, assignedTo: e.target.value})} className="bg-slate-800 px-2 py-1 text-sm text-white">
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => <option key={m._id} value={m._id}>{m.displayName}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowTaskForm(false)} className="px-3 py-1 text-sm text-slate-400">Cancel</button>
                <button onClick={() => addTask.mutate()} disabled={!taskForm.title.trim()} className="bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50">Create</button>
              </div>
            </div>
          )}
          <div className="p-2 space-y-1">
            {(workspace.tasks ?? []).map((t) => (
              <div key={t._id} className="flex items-start gap-2 p-2 hover:bg-slate-800">
                <button onClick={() => toggleTask.mutate({ taskId: t._id, done: !t.done })} className={t.done ? "text-green-500 mt-1" : "text-slate-500 mt-1"}>
                  {t.done ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <div className={`text-sm ${t.done ? "line-through text-slate-500" : "text-white"}`}>{t.title}</div>
                  {t.description && <div className="text-xs text-slate-500 mt-1">{t.description}</div>}
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className={t.priority === "High" ? "text-red-400" : t.priority === "Medium" ? "text-yellow-400" : "text-slate-500"}>{t.priority}</span>
                    {t.dueDate && <span className="text-slate-500">Due {d(t.dueDate)}</span>}
                    {t.assignedTo && <span className="text-cyan-400">{teamMembers.find(m => m._id === t.assignedTo)?.displayName}</span>}
                  </div>
                </div>
                {canManageWorkspace && <button onClick={() => deleteTask.mutate(t._id)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StartupWorkspace;

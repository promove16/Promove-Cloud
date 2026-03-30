import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Circle, Clock, Code2, Download, Github, MessageSquare, Paperclip, Plus, Rocket, Send, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { workspaceApi } from "../../api/workspace.api";
import { useWorkspaceChat } from "../../hooks/useWorkspaceChat";
import { useAuthStore } from "../../store/authStore";
import { WorkspaceTask } from "../../types/workspace.types";

const d = (value?: string) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set");
const dt = (value?: string) => (value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Just now");
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

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
  const [taskForm, setTaskForm] = useState({ title: "", priority: "Medium" as WorkspaceTask["priority"], assignedTo: "", dueDate: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [repoForm, setRepoForm] = useState({ repoUrl: "", branch: "", commitHash: "", note: "" });
  const [codeForm, setCodeForm] = useState({ title: "", language: "", summary: "", codeSnippet: "" });
  const [chatDraft, setChatDraft] = useState("");
  const [chatAttachment, setChatAttachment] = useState<File | null>(null);
  const [progressForm, setProgressForm] = useState({ note: "", milestoneRef: "", completionPercent: "", file: null as File | null });

  const listQuery = useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
  const workspaceId = projectId ?? listQuery.data?.[0]?._id;
  const workspaceQuery = useQuery({ queryKey: ["workspace", workspaceId], queryFn: () => workspaceApi.getById(workspaceId!), enabled: Boolean(workspaceId) });
  const workspace = workspaceQuery.data;
  const teamMembers = workspace?.teamMembers ?? [];
  const isOwner = workspace?.ownerId === currentUser?._id;
  const chat = useWorkspaceChat(workspaceId);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const refresh = async () => {
    if (!workspaceId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["score", "me"] }),
    ]);
  };

  const addTask = useMutation({
    mutationFn: () => workspaceApi.addTask(workspaceId!, { title: taskForm.title, priority: taskForm.priority, assignedTo: taskForm.assignedTo || undefined, dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined }),
    onSuccess: async () => {
      setTaskForm({ title: "", priority: "Medium", assignedTo: "", dueDate: "" });
      setShowTaskForm(false);
      setToast("Task added.");
      await refresh();
    },
  });
  const toggleTask = useMutation({ mutationFn: (payload: { taskId: string; done: boolean }) => workspaceApi.updateTask(workspaceId!, payload.taskId, { done: payload.done }), onSuccess: refresh });
  const deleteTask = useMutation({ mutationFn: (taskId: string) => workspaceApi.deleteTask(workspaceId!, taskId), onSuccess: async () => { setToast("Task removed."); await refresh(); } });
  const invite = useMutation({
    mutationFn: () => workspaceApi.invite(workspaceId!, { email: inviteEmail }),
    onSuccess: async () => { setInviteEmail(""); setShowInviteForm(false); setToast("Invite sent."); await refresh(); },
    onError: (error) => setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Unable to invite member."),
  });
  const removeMember = useMutation({ mutationFn: (userId: string) => workspaceApi.removeMember(workspaceId!, userId), onSuccess: async () => { setToast("Team member removed."); await refresh(); } });
  const deleteUpload = useMutation({ mutationFn: (uploadId: string) => workspaceApi.removeUpload(workspaceId!, uploadId), onSuccess: async () => { setToast("Upload removed."); await refresh(); } });
  const addRepo = useMutation({
    mutationFn: () => workspaceApi.addRepoSubmission(workspaceId!, { repoUrl: repoForm.repoUrl, branch: repoForm.branch || undefined, commitHash: repoForm.commitHash || undefined, note: repoForm.note || undefined }),
    onSuccess: async () => {
      setRepoForm({ repoUrl: "", branch: "", commitHash: "", note: "" });
      setToast("Repository link attached.");
      await refresh();
    },
    onError: (error) => setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Unable to attach repository."),
  });
  const deleteRepo = useMutation({ mutationFn: (repoId: string) => workspaceApi.removeRepoSubmission(workspaceId!, repoId), onSuccess: async () => { setToast("Repository link removed."); await refresh(); } });
  const addCode = useMutation({
    mutationFn: () => workspaceApi.addCodeSubmission(workspaceId!, codeForm),
    onSuccess: async () => {
      setCodeForm({ title: "", language: "", summary: "", codeSnippet: "" });
      setToast("Code snippet saved securely.");
      await refresh();
    },
    onError: (error) => setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Unable to save code snippet."),
  });
  const deleteCode = useMutation({ mutationFn: (codeId: string) => workspaceApi.removeCodeSubmission(workspaceId!, codeId), onSuccess: async () => { setToast("Code snippet removed."); await refresh(); } });
  const progress = useMutation({
    mutationFn: async () => {
      if (progressForm.file) await workspaceApi.upload(workspaceId!, progressForm.file, progressForm.note);
      return workspaceApi.addProgress(workspaceId!, { note: progressForm.note, milestoneRef: progressForm.milestoneRef || undefined, completionPercent: progressForm.completionPercent ? Number(progressForm.completionPercent) : undefined });
    },
    onSuccess: async () => {
      setProgressForm({ note: "", milestoneRef: "", completionPercent: "", file: null });
      setShowProgressModal(false);
      setToast("Progress uploaded! Your Innovation Score is being updated...");
      await refresh();
    },
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setToast("File size must be 10MB or less.");
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) return setToast("Only PDF and image files are allowed");
    try {
      await workspaceApi.upload(workspaceId!, file, uploadNote || undefined);
      setUploadNote("");
      setToast("File uploaded.");
      await refresh();
    } catch (error) {
      setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Upload failed.");
    }
  };

  const sendMessage = async () => {
    if (!workspaceId || (!chatDraft.trim() && !chatAttachment)) return;
    try {
      let attachmentUrl: string | undefined;
      let attachmentType: "pdf" | "image" | undefined;
      if (chatAttachment) {
        const uploads = await workspaceApi.upload(workspaceId, chatAttachment, "Chat attachment");
        const latest = uploads[uploads.length - 1];
        attachmentUrl = latest?.fileUrl;
        attachmentType = latest?.fileType;
        await refresh();
      }
      chat.sendMessage({ workspaceId, message: chatDraft.trim(), attachmentUrl, attachmentType });
      setChatDraft("");
      setChatAttachment(null);
    } catch (error) {
      setToast((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Unable to send chat attachment.");
    }
  };

  const nextMilestone = useMemo(() => workspace?.milestones.find((item) => !item.isCompleted)?.name ?? "Ready to launch", [workspace?.milestones]);

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Product Development Workspace</h1>
            <p className="text-slate-400 mb-3">Project: {workspace?.title ?? "No active workspace"} {workspace ? `- ${workspace.category}` : ""}</p>
            {workspace ? (
              <div className="flex items-center gap-4 flex-wrap">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-semibold">{workspace.category}</span>
                <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-semibold">{workspace.stage}</span>
                <div className="flex items-center gap-2 text-sm text-slate-400"><Clock className="w-4 h-4" />Started {d(workspace.createdAt)}</div>
              </div>
            ) : null}
          </div>
          <button onClick={() => setShowProgressModal(true)} disabled={!workspace} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
            <Upload className="w-5 h-5" />Upload Progress
          </button>
        </div>

        {toast ? <div className="fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 bg-slate-900 border border-blue-500/30 rounded-xl text-sm text-blue-200 shadow-xl">{toast}</div> : null}

        {!workspace && !listQuery.isLoading ? (
          <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-10 text-center">
            <Rocket className="w-10 h-10 text-slate-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">No workspace available yet</h2>
            <p className="text-slate-400 mb-5">Claim a problem from the Problem Bank to open your first workspace.</p>
            <button onClick={() => navigate("/problem-bank")} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold">Open Problem Bank</button>
          </div>
        ) : null}

        {workspace ? (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">Development Milestones</h2>
              <div className="space-y-4">
                {workspace.milestones.map((milestone) => (
                  <div key={milestone._id} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${milestone.isCompleted ? "bg-green-500/10" : milestone.completionPercent > 0 ? "bg-blue-500/10" : "bg-slate-800"}`}>
                      {milestone.isCompleted ? <CheckCircle className="w-6 h-6 text-green-500" /> : <Circle className={`w-6 h-6 ${milestone.completionPercent > 0 ? "text-blue-500" : "text-slate-600"}`} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-white">{milestone.name}</h3><span className="text-sm font-semibold text-white">{milestone.completionPercent}%</span></div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all ${milestone.isCompleted ? "bg-green-500" : "bg-gradient-to-r from-blue-500 to-purple-500"}`} style={{ width: `${milestone.completionPercent}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex gap-2">
              {["tasks", "team", "uploads", "chat"].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${activeTab === tab ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}>{tab === "chat" ? "Chat" : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {activeTab === "tasks" ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">Task Tracker</h2>
                      <button onClick={() => setShowTaskForm((value) => !value)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Plus className="w-4 h-4" />Add Task</button>
                    </div>
                    {showTaskForm ? (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-5 grid md:grid-cols-2 gap-3">
                        <input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" className="md:col-span-2 px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                        <select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as WorkspaceTask["priority"] }))} className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white"><option>High</option><option>Medium</option><option>Low</option></select>
                        <select value={taskForm.assignedTo} onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))} className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white"><option value="">Assign to team member</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.displayName}</option>)}</select>
                        <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                        <div className="md:col-span-2 flex justify-end gap-2"><button onClick={() => setShowTaskForm(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Cancel</button><button onClick={() => addTask.mutate()} disabled={!taskForm.title.trim() || addTask.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60">Save Task</button></div>
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      {(workspace.tasks || []).map((task) => {
                        const assignee = teamMembers.find((member) => member._id === task.assignedTo);
                        return (
                          <div key={task._id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                            <div className="flex items-start gap-4">
                              <button onClick={() => toggleTask.mutate({ taskId: task._id, done: !task.done })} className={`mt-1 ${task.done ? "text-green-500" : "text-slate-600 hover:text-blue-500"}`}>{task.done ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                              <div className="flex-1">
                                <h3 className={`font-semibold mb-2 ${task.done ? "text-slate-500 line-through" : "text-white"}`}>{task.title}</h3>
                                <div className="flex items-center gap-3 text-sm flex-wrap">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${task.priority === "High" ? "bg-red-500/10 text-red-400" : task.priority === "Medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"}`}>{task.priority}</span>
                                  <span className="text-slate-400">{assignee?.displayName ?? "Unassigned"}</span>
                                  <span className="text-slate-500">Due: {d(task.dueDate)}</span>
                                </div>
                              </div>
                              <button onClick={() => deleteTask.mutate(task._id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {activeTab === "team" ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">Team Members</h2>
                      {isOwner ? <button onClick={() => setShowInviteForm((value) => !value)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><UserPlus className="w-4 h-4" />Invite Member</button> : null}
                    </div>
                    {showInviteForm ? (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-5 flex gap-3">
                        <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Enter teammate email" className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                        <button onClick={() => invite.mutate()} disabled={!inviteEmail.trim() || invite.isPending} className="px-4 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-60">Send Invite</button>
                      </div>
                    ) : null}
                    <div className="space-y-4">
                      {teamMembers.map((member) => (
                        <div key={member._id} className="bg-slate-950 border border-slate-800 rounded-lg p-5">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-lg font-bold">{member.avatar ? <img src={member.avatar} alt={member.displayName} className="w-14 h-14 rounded-full object-cover" /> : initials(member.displayName)}</div>
                              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-950 ${member._id === currentUser?._id ? "bg-green-500" : "bg-slate-600"}`} />
                            </div>
                            <div className="flex-1"><h3 className="font-bold text-white mb-1">{member.displayName}</h3><p className="text-sm text-slate-400">{member._id === workspace.ownerId ? "Owner" : "Contributor"} • {member.role}</p></div>
                            {isOwner && member._id !== workspace.ownerId ? <button onClick={() => removeMember.mutate(member._id)} className="px-3 py-2 bg-slate-800 hover:bg-red-900/40 text-white text-sm rounded-lg">Remove</button> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === "uploads" ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6">Evidence & Submissions</h2>
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center bg-slate-950 mb-6">
                      <input id="workspace-upload" type="file" accept=".pdf,image/*" className="hidden" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} />
                      <label htmlFor="workspace-upload" className="cursor-pointer block"><Upload className="w-8 h-8 text-blue-400 mx-auto mb-3" /><div className="text-white font-semibold mb-2">Drag-and-drop or click to upload</div><div className="text-sm text-slate-400 mb-4">PDF and image files only, up to 10MB</div></label>
                      <input value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} placeholder="Optional note for this upload" className="w-full max-w-xl mx-auto px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                    </div>
                    <div className="grid gap-6 xl:grid-cols-2 mb-6">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Github className="w-5 h-5 text-slate-300" />
                          <h3 className="font-semibold text-white">Attach GitHub Repository</h3>
                        </div>
                        <div className="space-y-3">
                          <input value={repoForm.repoUrl} onChange={(event) => setRepoForm((current) => ({ ...current, repoUrl: event.target.value }))} placeholder="https://github.com/org/repo" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                          <div className="grid grid-cols-2 gap-3">
                            <input value={repoForm.branch} onChange={(event) => setRepoForm((current) => ({ ...current, branch: event.target.value }))} placeholder="Branch (optional)" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                            <input value={repoForm.commitHash} onChange={(event) => setRepoForm((current) => ({ ...current, commitHash: event.target.value }))} placeholder="Commit hash (optional)" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                          </div>
                          <textarea value={repoForm.note} onChange={(event) => setRepoForm((current) => ({ ...current, note: event.target.value }))} placeholder="What should reviewers look at in this repo?" className="w-full min-h-24 px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                          <button onClick={() => addRepo.mutate()} disabled={!repoForm.repoUrl.trim() || addRepo.isPending} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold disabled:opacity-60">Attach Repository</button>
                          <p className="text-xs text-slate-500">Only HTTPS GitHub links are accepted. Embedded credentials and access tokens are blocked.</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Code2 className="w-5 h-5 text-slate-300" />
                          <h3 className="font-semibold text-white">Save Code Snippet Safely</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input value={codeForm.title} onChange={(event) => setCodeForm((current) => ({ ...current, title: event.target.value }))} placeholder="Snippet title" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                            <input value={codeForm.language} onChange={(event) => setCodeForm((current) => ({ ...current, language: event.target.value }))} placeholder="Language" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                          </div>
                          <input value={codeForm.summary} onChange={(event) => setCodeForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Short summary (optional)" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
                          <textarea value={codeForm.codeSnippet} onChange={(event) => setCodeForm((current) => ({ ...current, codeSnippet: event.target.value }))} placeholder="Paste only non-sensitive code. Secrets, keys, and credentials are blocked automatically." className="w-full min-h-40 px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-sm" />
                          <button onClick={() => addCode.mutate()} disabled={!codeForm.title.trim() || !codeForm.language.trim() || !codeForm.codeSnippet.trim() || addCode.isPending} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold disabled:opacity-60">Save Code Snippet</button>
                          <p className="text-xs text-slate-500">Code is stored as text only. It is never executed server-side.</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      <h3 className="font-semibold text-white">Uploaded Files</h3>
                      {(workspace.uploads || []).map((upload) => {
                        const uploader = teamMembers.find((member) => member._id === upload.uploadedBy);
                        return (
                          <div key={upload._id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-between gap-4">
                            <div><div className="font-semibold text-white">{upload.fileName}</div><div className="text-sm text-slate-400">{upload.fileType.toUpperCase()} • {(upload.fileSizeBytes / 1024 / 1024).toFixed(2)} MB • {uploader?.displayName ?? "Team member"} • {dt(upload.uploadedAt)}</div>{upload.note ? <div className="text-xs text-blue-300 mt-1">{upload.note}</div> : null}</div>
                            <div className="flex items-center gap-2"><a href={upload.fileUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 text-sm"><Download className="w-4 h-4" />Open</a><button onClick={() => deleteUpload.mutate(upload._id)} className="px-3 py-2 bg-slate-800 hover:bg-red-900/40 text-white rounded-lg text-sm">Delete</button></div>
                          </div>
                        );
                      })}
                      {(workspace.uploads || []).length === 0 ? <div className="text-sm text-slate-500">No documents or images uploaded yet.</div> : null}
                    </div>
                    <div className="space-y-3 mb-6">
                      <h3 className="font-semibold text-white">Repository Links</h3>
                      {(workspace.repoSubmissions || []).map((repo) => {
                        const uploader = teamMembers.find((member) => member._id === repo.uploadedBy);
                        return (
                          <div key={repo._id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-between gap-4">
                            <div>
                              <div className="font-semibold text-white">{repo.displayName}</div>
                              <div className="text-sm text-slate-400">GitHub • {uploader?.displayName ?? "Team member"} • {dt(repo.uploadedAt)}</div>
                              {(repo.branch || repo.commitHash) ? <div className="text-xs text-slate-500 mt-1">{repo.branch ? `Branch: ${repo.branch}` : ""} {repo.commitHash ? `Commit: ${repo.commitHash}` : ""}</div> : null}
                              {repo.note ? <div className="text-xs text-blue-300 mt-1">{repo.note}</div> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={repo.repoUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 text-sm"><Github className="w-4 h-4" />Open</a>
                              <button onClick={() => deleteRepo.mutate(repo._id)} className="px-3 py-2 bg-slate-800 hover:bg-red-900/40 text-white rounded-lg text-sm">Delete</button>
                            </div>
                          </div>
                        );
                      })}
                      {(workspace.repoSubmissions || []).length === 0 ? <div className="text-sm text-slate-500">No repository links attached yet.</div> : null}
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">Code Snippets</h3>
                      {(workspace.codeSubmissions || []).map((snippet) => {
                        const uploader = teamMembers.find((member) => member._id === snippet.uploadedBy);
                        return (
                          <div key={snippet._id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="font-semibold text-white">{snippet.title}</div>
                                <div className="text-sm text-slate-400">{snippet.language} • {snippet.lineCount} lines • {uploader?.displayName ?? "Team member"} • {dt(snippet.uploadedAt)}</div>
                                {snippet.summary ? <div className="text-xs text-blue-300 mt-1">{snippet.summary}</div> : null}
                              </div>
                              <button onClick={() => deleteCode.mutate(snippet._id)} className="px-3 py-2 bg-slate-800 hover:bg-red-900/40 text-white rounded-lg text-sm">Delete</button>
                            </div>
                            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-200"><code>{snippet.codeSnippet}</code></pre>
                          </div>
                        );
                      })}
                      {(workspace.codeSubmissions || []).length === 0 ? <div className="text-sm text-slate-500">No code snippets saved yet.</div> : null}
                    </div>
                  </div>
                ) : null}

                {activeTab === "chat" ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-6">Team Chat</h2>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-4 h-[420px] overflow-y-auto">
                      <div className="space-y-4">
                        {chat.messages.map((message) => {
                          const sender = teamMembers.find((member) => member._id === message.senderId);
                          return (
                            <div key={message._id} className="flex gap-3">
                              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials(sender?.displayName ?? "User")}</div>
                              <div className="flex-1 bg-slate-900 rounded-lg p-3"><div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold text-white">{sender?.displayName ?? "Team member"}</span><span className="text-xs text-slate-500">{dt(message.sentAt)}</span></div>{message.message ? <p className="text-sm text-slate-300">{message.message}</p> : null}{message.attachmentUrl ? <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex mt-3 px-3 py-2 bg-slate-800 text-blue-300 rounded-lg text-sm">{message.attachmentType === "pdf" ? "Open PDF attachment" : "Open image attachment"}</a> : null}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <textarea value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Share an update with your team..." className="w-full min-h-24 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold cursor-pointer flex items-center gap-2"><Paperclip className="w-4 h-4" />Attach PDF/Image<input type="file" accept=".pdf,image/*" className="hidden" onChange={(event) => setChatAttachment(event.target.files?.[0] ?? null)} /></label>
                        {chatAttachment ? <span className="text-sm text-slate-400">{chatAttachment.name}</span> : null}
                        <button onClick={() => void sendMessage()} className="ml-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2"><Send className="w-4 h-4" />Send</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h3 className="font-bold text-white mb-4">Project Stats</h3>
                  <div className="space-y-4">
                    <div><div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Overall Progress</span><span className="text-white font-bold">{workspace.progressPercent || 0}%</span></div><div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${workspace.progressPercent || 0}%` }} /></div></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white mb-1">{(workspace.tasks || []).filter((task) => task.done).length}</div><div className="text-xs text-slate-400">Tasks Done</div></div>
                      <div className="bg-slate-950 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white mb-1">{(workspace.tasks || []).filter((task) => !task.done).length}</div><div className="text-xs text-slate-400">Open Tasks</div></div>
                      <div className="bg-slate-950 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white mb-1">{teamMembers.length}</div><div className="text-xs text-slate-400">Team Members</div></div>
                      <div className="bg-slate-950 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white mb-1">{(workspace.uploads || []).length + (workspace.repoSubmissions || []).length + (workspace.codeSubmissions || []).length}</div><div className="text-xs text-slate-400">Evidence Items</div></div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h3 className="font-bold text-white mb-4">Recent Updates</h3>
                  <div className="space-y-4">
                    {(workspace.progressUpdates || []).length > 0 ? (workspace.progressUpdates || []).slice(-4).reverse().map((update) => {
                      const author = teamMembers.find((member) => member._id === update.submittedBy);
                      return <div key={update._id} className="text-sm"><div className="text-white font-semibold">{author?.displayName ?? "Team member"}</div><div className="text-slate-400">{update.note}</div><div className="text-xs text-slate-500 mt-1">{dt(update.submittedAt)}</div></div>;
                    }) : <div className="text-sm text-slate-400">Progress updates will appear here after your first upload.</div>}
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-6">
                  <h3 className="font-bold text-white mb-3">Workspace Focus</h3>
                  <p className="text-sm text-slate-400 mb-4">Next milestone: {nextMilestone}</p>
                  <button onClick={() => setActiveTab("chat")} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">Open Team Chat</button>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {showProgressModal && workspace ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold text-white">Upload Progress</h2><button onClick={() => setShowProgressModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
              <div className="space-y-4">
                <textarea value={progressForm.note} onChange={(event) => setProgressForm((current) => ({ ...current, note: event.target.value }))} placeholder="What progress did your team make today?" className="w-full min-h-32 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
                <div className="grid md:grid-cols-2 gap-3">
                  <select value={progressForm.milestoneRef} onChange={(event) => setProgressForm((current) => ({ ...current, milestoneRef: event.target.value }))} className="px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white"><option value="">Select milestone</option>{workspace.milestones.map((milestone) => <option key={milestone._id} value={milestone.name}>{milestone.name}</option>)}</select>
                  <input type="number" min="0" max="100" value={progressForm.completionPercent} onChange={(event) => setProgressForm((current) => ({ ...current, completionPercent: event.target.value }))} placeholder="Completion %" className="px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
                </div>
                <label className="block px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white cursor-pointer">Attach optional PDF/image<input type="file" accept=".pdf,image/*" className="hidden" onChange={(event) => setProgressForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} /></label>
                {progressForm.file ? <div className="text-sm text-slate-400">{progressForm.file.name}</div> : null}
                <div className="flex justify-end gap-3"><button onClick={() => setShowProgressModal(false)} className="px-5 py-3 bg-slate-800 text-white rounded-lg font-semibold">Cancel</button><button onClick={() => progress.mutate()} disabled={!progressForm.note.trim() || progress.isPending} className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-60">Submit Progress</button></div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

import { X, FileText, FileSpreadsheet, Presentation, File, Image, Video, Music, Download, ExternalLink } from "lucide-react";
import type { WorkspaceUpload, WorkspaceUploadFileType } from "../../types/workspace.types";

interface FileViewerModalProps {
  upload: WorkspaceUpload | null;
  onClose: () => void;
}

const getFileIcon = (fileType: WorkspaceUploadFileType) => {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-12 w-12 text-red-500" />;
    case "doc":
      return <FileText className="h-12 w-12 text-blue-500" />;
    case "ppt":
      return <Presentation className="h-12 w-12 text-orange-500" />;
    case "xls":
      return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
    case "image":
      return <Image className="h-12 w-12 text-purple-500" />;
    case "video":
      return <Video className="h-12 w-12 text-pink-500" />;
    case "audio":
      return <Music className="h-12 w-12 text-cyan-500" />;
    default:
      return <File className="h-12 w-12 text-slate-500" />;
  }
};

const getFileTypeLabel = (fileType: WorkspaceUploadFileType) => {
  switch (fileType) {
    case "pdf":
      return "PDF Document";
    case "doc":
      return "Word Document";
    case "ppt":
      return "PowerPoint Presentation";
    case "xls":
      return "Excel Spreadsheet";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    default:
      return "File";
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const canPreviewInline = (fileType: WorkspaceUploadFileType): boolean => {
  return fileType === "image" || fileType === "video" || fileType === "audio" || fileType === "pdf";
};

export function FileViewerModal({ upload, onClose }: FileViewerModalProps) {
  if (!upload) return null;

  const isPreviewable = canPreviewInline(upload.fileType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            {getFileIcon(upload.fileType)}
            <div>
              <h3 className="text-lg font-semibold text-white">{upload.fileName}</h3>
              <p className="text-sm text-slate-400">
                {getFileTypeLabel(upload.fileType)} • {formatFileSize(upload.fileSizeBytes)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-auto p-6" style={{ maxHeight: "calc(90vh - 140px)" }}>
          {isPreviewable ? (
            upload.fileType === "image" ? (
              <div className="flex justify-center">
                <img
                  src={upload.fileUrl}
                  alt={upload.fileName}
                  className="max-h-[70vh] w-auto rounded-lg object-contain"
                />
              </div>
            ) : upload.fileType === "video" ? (
              <div className="flex justify-center">
                <video
                  src={upload.fileUrl}
                  controls
                  className="max-h-[70vh] w-full rounded-lg"
                >
                  Your browser does not support video playback.
                </video>
              </div>
            ) : upload.fileType === "audio" ? (
              <div className="flex justify-center py-8">
                <audio src={upload.fileUrl} controls className="w-full max-w-md">
                  Your browser does not support audio playback.
                </audio>
              </div>
            ) : (
              <div className="flex justify-center">
                <iframe
                  src={upload.fileUrl}
                  className="h-[70vh] w-full rounded-lg border border-slate-700"
                  title={upload.fileName}
                />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {getFileIcon(upload.fileType)}
              <h4 className="mt-4 text-lg font-semibold text-white">
                Preview not available
              </h4>
              <p className="mt-2 max-w-md text-slate-400">
                This file type cannot be previewed directly. You can download it to view locally.
              </p>
              <div className="mt-6 flex gap-4">
                <a
                  href={upload.fileUrl}
                  download={upload.fileName}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <a
                  href={upload.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 px-6 py-4">
          <div className="text-sm text-slate-400">
            Uploaded: {new Date(upload.uploadedAt).toLocaleString("en-IN")}
          </div>
          <div className="flex gap-3">
            <a
              href={upload.fileUrl}
              download={upload.fileName}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <a
              href={upload.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              <ExternalLink className="h-4 w-4" />
              Open External
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

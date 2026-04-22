import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Play, Video, Maximize2, RefreshCw, Download, Settings, ArrowLeft, ArrowRight, CloudUpload, Info, FileVideo, Volume2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SubtitleLine } from '@/lib/api';

interface SubtitleStepProps {
  subtitleMode: 'auto' | 'upload' | null;
  onModeSelect: (mode: 'auto' | 'upload') => void;
  isRecognizing: boolean;
  recognitionDone: boolean;
  onStartRecognition: () => void;
  subtitles: SubtitleLine[];
  onSubtitlesChange: (subs: SubtitleLine[]) => void;
  onSubtitleFileSelect?: (file: File, parsed: SubtitleLine[]) => void;
  videoFile?: File | null;
  videoUrl?: string;
  onReupload?: () => void;
  onBack?: () => void;
  onNext?: () => void;
}

function parseSRT(srt: string): SubtitleLine[] {
  // 先清理行尾空格，然后用一个或多个空白行（可能包含空格）分割
  const cleaned = srt.replace(/[ \t]+\n/g, '\n');
  const blocks = cleaned.trim().split(/\r?\n\s*\r?\n+/);

  return blocks
    .map((block, index) => {
      const lines = block.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const timeLine = lines.find((line) => line.includes('-->')) || '';
      const textLines = lines.filter((line) => !/^\d+$/.test(line.trim()) && !line.includes('-->'));
      const timeMatch = timeLine.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);

      return {
        id: index + 1,
        start: timeMatch ? timeMatch[1].replace(',', '.') : `${index * 5}.0s`,
        end: timeMatch ? timeMatch[2].replace(',', '.') : `${index * 5 + 5}.0s`,
        text: textLines.join(' ').trim() || `字幕 ${index + 1}`,
      };
    })
    .filter((item) => item.text.length > 0);
}

// 格式化时间显示："00:00:21.500" -> "21.5s"
function formatTimeDisplay(timeStr: string): string {
  const match = timeStr.match(/(\d+):(\d+):(\d+)[.,]?(\d*)/);
  if (!match) return timeStr;
  const [, h, m, s, ms] = match;
  const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
  const firstDecimal = ms ? ms.padEnd(3, '0').slice(0, 1) : '0';
  return `${totalSeconds}.${firstDecimal}s`;
}

function formatClock(sec: number, withHour = false): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (withHour || h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '未知';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
}

export default function SubtitleStep({
  subtitleMode,
  onModeSelect,
  isRecognizing,
  recognitionDone,
  onStartRecognition,
  subtitles,
  onSubtitlesChange,
  onSubtitleFileSelect,
  videoFile,
  videoUrl,
  onReupload,
  onBack,
  onNext,
}: SubtitleStepProps) {
  const srtInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolution, setResolution] = useState<string>('');
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setResolution('');
  }, [videoUrl]);

  const onLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
    if (el.videoWidth && el.videoHeight) {
      setResolution(`${el.videoWidth}×${el.videoHeight}`);
    }
  };

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime || 0);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      const parsed = parseSRT(content);
      onSubtitlesChange(parsed);
      onModeSelect('upload');
      onSubtitleFileSelect?.(file, parsed);
    };
    reader.readAsText(file);
  };

  const handleEditStart = (sub: SubtitleLine) => {
    setEditingId(sub.id);
    setEditText(sub.text);
  };

  const handleEditSave = (id: number) => {
    onSubtitlesChange(subtitles.map((s) => (s.id === id ? { ...s, text: editText } : s)));
    setEditingId(null);
  };

  const handleDelete = (id: number) => {
    onSubtitlesChange(subtitles.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleExport = () => {
    let srtContent = '';
    subtitles.forEach((sub, index) => {
      const start = sub.start.replace('.', ',');
      const end = sub.end.replace('.', ',');
      srtContent += `${index + 1}\n${start} --> ${end}\n${sub.text}\n\n`;
    });
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 初始状态 - 选择识别方式
  if (!subtitleMode && !recognitionDone) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">字幕识别</h2>
            <p className="text-sm text-slate-400">选择字幕获取方式，支持自动识别或上传已有字幕文件</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 自动识别 */}
            <button
              onClick={onStartRecognition}
              disabled={isRecognizing}
              className="group p-6 rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#46ec13]/30 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-[#46ec13]/10 border border-[#46ec13]/20 flex items-center justify-center mb-4 group-hover:bg-[#46ec13]/20 transition-colors">
                {isRecognizing ? (
                  <div className="w-5 h-5 border-2 border-[#46ec13]/30 border-t-[#46ec13] rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5 text-[#46ec13]" />
                )}
              </div>
              <h3 className="text-base font-medium text-white mb-1">自动识别</h3>
              <p className="text-xs text-slate-500">使用AI语音识别自动生成字幕</p>
            </button>

            {/* 上传字幕 */}
            <button
              onClick={() => srtInputRef.current?.click()}
              className="group p-6 rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#46ec13]/30 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-[#46ec13]/10 border border-[#46ec13]/20 flex items-center justify-center mb-4 group-hover:bg-[#46ec13]/20 transition-colors">
                <Upload className="w-5 h-5 text-[#46ec13]" />
              </div>
              <h3 className="text-base font-medium text-white mb-1">上传字幕</h3>
              <p className="text-xs text-slate-500">支持 SRT、VTT 格式字幕文件</p>
            </button>
            <input ref={srtInputRef} type="file" accept=".srt,.vtt,.txt" className="hidden" onChange={handleSrtUpload} />
          </div>
        </div>
      </div>
    );
  }

  // 识别中状态
  if (isRecognizing) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#46ec13]/10 border border-[#46ec13]/20 flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-2 border-[#46ec13]/30 border-t-[#46ec13] rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">正在识别字幕...</h3>
          <p className="text-sm text-slate-500">请稍候，AI正在分析视频音频内容</p>
        </div>
      </div>
    );
  }

  const fileSizeText = formatFileSize(videoFile?.size ?? 0);
  const durationText = duration > 0 ? formatClock(duration, true) : '00:00:00';

  // 字幕编辑状态
  const showPlaceholder = !videoUrl || videoFailed;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 主内容区：左视频信息(1) + 右字幕列表(2)，等高各自滚动 */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_2fr] overflow-hidden min-h-0">
        {/* 左侧：视频预览(固定) + 元数据(滚动) */}
        <div className="flex flex-col min-h-0 md:border-r border-white/[0.06]">
          <div className="p-5 pb-4 shrink-0 space-y-4">
            <div className="relative aspect-video w-full rounded-2xl bg-black overflow-hidden">
              {!showPlaceholder ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    onLoadedMetadata={onLoadedMetadata}
                    onTimeUpdate={onTimeUpdate}
                    onError={() => setVideoFailed(true)}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <button className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 flex items-center justify-center text-white/70 hover:text-white z-10">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                  <button className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4">
                    <Video className="w-6 h-6 text-white/60" />
                  </div>
                  <p className="text-white font-medium text-base mb-1">视频链接已失效</p>
                  <p className="text-xs text-slate-500 mb-5">视频文件仅在本地处理，不上传云端</p>
                  <Button
                    onClick={onReupload}
                    className="bg-[#46ec13] hover:bg-[#37c00c] text-black font-medium gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />重新选择视频
                  </Button>
                </div>
              )}
            </div>

            {/* 时间轴 */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">{formatClock(currentTime)}</span>
                <span className="font-mono">{durationText}</span>
              </div>
              <div className="relative mt-2 h-1 rounded-full bg-white/10">
                <div className="absolute left-0 top-0 h-full rounded-full bg-[#46ec13]/60" style={{ width: `${progressPct}%` }} />
                <div
                  className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#46ec13] shadow"
                  style={{ left: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* 元数据（独立滚动） */}
          <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-[#46ec13]" />
              <span className="text-sm font-semibold text-white">元数据</span>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileVideo className="w-4 h-4 text-[#46ec13]" />
                <span className="text-sm font-medium text-white">视频信息</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">分辨率</dt>
                  <dd className="text-slate-200 font-medium">{resolution || '未知'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">时长</dt>
                  <dd className="text-slate-200 font-medium font-mono">{durationText}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">文件大小</dt>
                  <dd className="text-slate-200 font-medium">{fileSizeText}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-[#46ec13]" />
                <span className="text-sm font-medium text-white">音频信息</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">采样率</dt>
                  <dd className="text-slate-200 font-medium">48kHz</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">声道</dt>
                  <dd className="text-slate-200 font-medium">立体声</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">比特率</dt>
                  <dd className="text-slate-200 font-medium">192kbps</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* 右侧：字幕列表 */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h3 className="text-base font-semibold text-white">字幕预览与编辑</h3>
              <p className="text-xs text-slate-500 mt-0.5">共 {subtitles.length} 条字幕 · 点击气泡即可编辑</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-[#46ec13] hover:bg-[#46ec13]/10 rounded-md transition"
              >
                <Download className="w-3.5 h-3.5" />导出
              </button>
              <button
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition"
                title="设置"
              >
                <Settings className="w-4 h-4" />
              </button>
              <input ref={srtInputRef} type="file" accept=".srt,.vtt,.txt" className="hidden" onChange={handleSrtUpload} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {subtitles.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-7 h-7 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500">暂无字幕数据</p>
                </div>
              </div>
            ) : (
              subtitles.map((sub) => (
                <div key={sub.id} className="group flex items-center gap-2">
                  <span className="shrink-0 px-3 py-1.5 rounded-full bg-[#46ec13]/12 border border-[#46ec13]/30 text-[#46ec13] text-xs font-medium font-mono whitespace-nowrap">
                    {formatTimeDisplay(sub.start)} · {formatTimeDisplay(sub.end)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {editingId === sub.id ? (
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => handleEditSave(sub.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(sub.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="w-full h-12 rounded-xl bg-white/[0.04] border border-[#46ec13]/40 px-4 text-sm text-white outline-none focus:border-[#46ec13]"
                      />
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleEditStart(sub)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleEditStart(sub);
                          }
                        }}
                        title={sub.text}
                        className="subtitle-row-scroll w-full h-12 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#46ec13]/30 px-4 pt-3 text-sm text-slate-200 transition cursor-text"
                      >
                        {sub.text}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(sub.id)}
                    title="删除此条字幕"
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="h-16 border-t border-white/[0.06] bg-[#0A0A0F] flex items-center justify-between px-6 shrink-0">
        <div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white gap-1.5">
              <ArrowLeft className="w-4 h-4" />返回
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onReupload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReupload}
              className="border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04] gap-1.5"
            >
              <CloudUpload className="w-4 h-4" />重新上传
            </Button>
          )}
          {onNext && (
            <Button
              size="sm"
              onClick={onNext}
              disabled={subtitles.length === 0}
              className="bg-[#46ec13] hover:bg-[#46ec13]/90 text-black font-medium gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一步：配置参数
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

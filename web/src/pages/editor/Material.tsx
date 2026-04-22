import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle2, RefreshCcw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type Project,
  type ScriptItem,
  updateProject,
} from '@/lib/projects-store';
import { toast } from 'sonner';
import {
  createMovieStoryJob,
  createSubtitleJob,
  extractMovieStoryArtifacts,
  extractSubtitleArtifact,
  readSubtitleLines,
  uploadSubtitle,
  uploadVideo,
  waitForJob,
  type SubtitleLine,
} from '@/lib/api';
import VideoUploadStep from '@/components/workspace/VideoUploadStep';
import SubtitleStep from '@/components/workspace/SubtitleStep';
import ConfigStep, {
  type ConfigFormValue,
} from '@/components/workspace/ConfigStep';
import CopywritingPreviewDialog from '@/components/workspace/CopywritingPreviewDialog';
import GenerationProgressModal, {
  type GenerationStep,
} from '@/components/workspace/GenerationProgressModal';

type Ctx = { project?: Project };

type Phase = 'upload' | 'subtitle' | 'config' | 'generate';

const STEPS = [
  { key: 'upload', label: '视频上传', matches: ['upload', 'subtitle'] as Phase[] },
  { key: 'config', label: '参数配置', matches: ['config'] as Phase[] },
  { key: 'generate', label: '内容生成', matches: ['generate'] as Phase[] },
] as const;

const defaultConfig: ConfigFormValue = {
  editMode: 'smart_insert',
  originalRatio: 45,
  videoLanguage: 'zh',
  narrationLanguage: 'zh',
  generationMode: 'auto',
  speechSpeed: 'moderate',
  wordCount: 'default',
  perspective: 'third',
  narrationStyle: 'default',
  scriptType: 'standard',
  temperature: 0.7,
  ttsEngine: 'edge-tts',
  voiceRole: 'female_gentle',
  speed: 1,
  aspectRatio: '16:9',
  videoQuality: 'high',
  subtitleFont: 'default',
  subtitleSize: 24,
  subtitleEnabled: true,
};

function normalizeScriptItems(items: any[]): ScriptItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const startTime = String(item?.timestamp?.split('-')?.[0] || item?.start || item?.startTime || '');
    const endTime = String(item?.timestamp?.split('-')?.[1] || item?.end || item?.endTime || '');
    const narration = String(item?.narration || item?.new_content || item?.content || item?.text || '');
    const originalSubtitle = String(
      item?.original_subtitle || item?.originalSubtitle || item?.subtitle_text || item?.original || ''
    );
    return {
      id: String(item?.id || item?._id || `s${index + 1}`),
      startTime: startTime || '00:00:00,000',
      endTime: endTime || '00:00:00,000',
      originalSubtitle,
      narration,
    };
  });
}

export default function MaterialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project } = useOutletContext<Ctx>();

  const [phase, setPhase] = useState<Phase>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(project?.videoUrl);
  const [uploadedVideoPath, setUploadedVideoPath] = useState<string>('');
  const [uploadedSubtitlePath, setUploadedSubtitlePath] = useState<string>('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const [subtitleMode, setSubtitleMode] = useState<'auto' | 'upload' | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionDone, setRecognitionDone] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);

  const [config, setConfig] = useState<ConfigFormValue>(defaultConfig);

  const [generating, setGenerating] = useState(false);
  const [progressSteps, setProgressSteps] = useState<GenerationStep[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [pendingScript, setPendingScript] = useState<ScriptItem[]>([]);

  const uploadTokenRef = useRef(0);

  useEffect(() => {
    setVideoUrl(project?.videoUrl);
  }, [project?.videoUrl]);

  if (!id || !project) {
    return (
      <div className="container-workspace py-20 text-center text-white/60">
        项目不存在或已被删除。
        <Button className="ml-3" onClick={() => navigate('/projects')}>
          返回项目列表
        </Button>
      </div>
    );
  }

  const activeStepIdx = STEPS.findIndex((s) => (s.matches as Phase[]).includes(phase));

  const onVideoPicked = async (file: File | null) => {
    setUploadedFile(file);
    setUploadedVideoPath('');
    setUploadedSubtitlePath('');
    setSubtitles([]);
    setRecognitionDone(false);
    setSubtitleMode(null);

    if (!file) {
      setVideoUrl(undefined);
      updateProject(id, { videoFileName: undefined, videoUrl: undefined });
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    updateProject(id, {
      videoFileName: file.name,
      videoUrl: url,
      currentStep: 'upload',
    });

    const token = ++uploadTokenRef.current;
    setIsUploadingVideo(true);
    try {
      const resp = await uploadVideo(file);
      if (token !== uploadTokenRef.current) return; // 用户切过文件
      setUploadedVideoPath(resp.path);
    } catch (err) {
      if (token !== uploadTokenRef.current) return;
      toast.error(
        `视频上传到服务端失败：${err instanceof Error ? err.message : '未知错误'}`
      );
    } finally {
      if (token === uploadTokenRef.current) setIsUploadingVideo(false);
    }
  };

  const onSubtitleStart = async () => {
    if (!uploadedVideoPath) {
      if (isUploadingVideo) {
        toast.info('视频仍在上传至服务端，请稍候再试');
      } else {
        toast.error('视频尚未上传到服务端，请重新选择视频');
      }
      return;
    }
    setSubtitleMode('auto');
    setIsRecognizing(true);
    try {
      const job = await createSubtitleJob({ video_path: uploadedVideoPath });
      const snapshot = await waitForJob(job.task_id, { intervalMs: 1500 });
      const subtitlePath = extractSubtitleArtifact(snapshot);
      if (!subtitlePath) {
        throw new Error('后端未返回字幕文件路径');
      }
      const lines = await readSubtitleLines(subtitlePath);
      setSubtitles(lines);
      setUploadedSubtitlePath(subtitlePath);
      setRecognitionDone(true);
      toast.success(`字幕识别完成，共 ${lines.length} 条`);
    } catch (err) {
      toast.error(
        `字幕识别失败：${err instanceof Error ? err.message : '未知错误'}`
      );
      setSubtitleMode(null);
    } finally {
      setIsRecognizing(false);
    }
  };

  const onSubtitleFileUploaded = async (
    file: File,
    parsed: SubtitleLine[]
  ) => {
    setSubtitles(parsed);
    setRecognitionDone(true);
    try {
      const resp = await uploadSubtitle(file);
      setUploadedSubtitlePath(resp.path);
    } catch (err) {
      toast.error(
        `字幕文件上传到服务端失败：${err instanceof Error ? err.message : '未知错误'}`
      );
    }
  };

  const setStepStatus = (
    key: string,
    status: GenerationStep['status'],
    hint?: string
  ) => {
    setProgressSteps((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, status, ...(hint ? { hint } : {}) } : s
      )
    );
  };

  const generate = async () => {
    if (!uploadedVideoPath) {
      toast.error('视频尚未上传到服务端，请重新选择视频');
      return;
    }
    setGenerating(true);
    const stepsDef: GenerationStep[] = [
      { key: 'check', label: '校验视频与配置', status: 'running' },
      { key: 'llm', label: '正在请求大模型', status: 'pending', hint: 'AI 正在创作解说文案…' },
      { key: 'parse', label: '解析生成结果', status: 'pending' },
    ];
    setProgressSteps(stepsDef);
    try {
      setStepStatus('check', 'done');
      setStepStatus('llm', 'running');

      const job = await createMovieStoryJob({
        video_path: uploadedVideoPath,
        subtitle_path: uploadedSubtitlePath || undefined,
        video_theme: project?.name || '',
        narration_style:
          config.narrationStyle === 'default' ? 'general' : config.narrationStyle,
        generation_mode:
          config.generationMode === 'auto' ? 'balanced' : config.generationMode,
        visual_mode: 'auto',
        target_duration_minutes: 8,
        highlight_only: config.editMode === 'highlight_only',
      });

      const snapshot = await waitForJob(job.task_id, {
        intervalMs: 2000,
        onTick: (snap) => {
          if (snap.message) {
            setStepStatus('llm', 'running', snap.message);
          }
        },
      });

      setStepStatus('llm', 'done');
      setStepStatus('parse', 'running');

      const artifacts = extractMovieStoryArtifacts(snapshot);
      const items = normalizeScriptItems(artifacts.scriptItems);
      if (items.length === 0) {
        throw new Error('后端未返回解说脚本，请检查日志');
      }

      setStepStatus('parse', 'done');
      setPendingScript(items);
      setPreviewText(items.map((s) => s.narration).join('\n\n'));
      setGenerating(false);
      setProgressSteps([]);
      toast.success('解说文案已生成，请预览并确认');
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
      setProgressSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'error' } : s
        )
      );
      setGenerating(false);
      setTimeout(() => setProgressSteps([]), 600);
    }
  };

  const confirmPreview = (text: string) => {
    const lines = text.split(/\n\n+/).filter(Boolean);
    const next = pendingScript.map((s, i) => ({ ...s, narration: lines[i] ?? s.narration }));
    updateProject(id, {
      status: 'completed',
      currentStep: 'generate',
      scriptItems: next,
    });
    const now = new Date();
    toast.success(`脚本已保存，共 ${next.length} 段 · ${now.toLocaleTimeString()}`);
    setPreviewOpen(false);
    navigate(`/projects/${id}/analysis`);
  };

  return (
    <div className="container-workspace py-8 flex-1 flex flex-col">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">
          项目名称：<span className="text-[#46ec13]">{project.name}</span>
        </h2>
        <p className="text-sm text-white/55 mt-1">
          上传您的视频文件，系统将自动提取音频并识别字幕
        </p>
      </header>

      {/* Step indicator */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {STEPS.map((s, i) => {
            const active = activeStepIdx === i;
            const done = activeStepIdx > i;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1 min-w-[160px]">
                <button
                  type="button"
                  onClick={() => {
                    if (i === 0) setPhase(uploadedFile || videoUrl ? 'subtitle' : 'upload');
                    else if (i === 1) setPhase('config');
                    else setPhase('generate');
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full transition',
                    active ? 'text-[#46ec13]' : done ? 'text-white/85 hover:text-white' : 'text-white/50 hover:text-white'
                  )}
                >
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border',
                      active
                        ? 'bg-[#46ec13] text-[#060a07] border-[#46ec13]'
                        : done
                          ? 'bg-[#46ec13]/90 text-[#060a07] border-[#46ec13]/90'
                          : 'bg-white/5 text-white/60 border-white/15'
                    )}
                  >
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm">{s.label}</span>
                </button>
                {i < STEPS.length - 1 ? (
                  <div className={cn('flex-1 h-px', done ? 'bg-[#46ec13]/50' : 'bg-white/10')} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase content - card wrapper */}
      <div
        className={cn(
          'rounded-2xl border border-white/[0.06] bg-[#0a0a0f] overflow-hidden flex flex-col',
          phase === 'subtitle' ? 'shrink-0' : 'flex-1 min-h-[640px]'
        )}
        style={phase === 'subtitle' ? { height: 720 } : undefined}
      >
        {phase === 'upload' && (
          <VideoUploadStep
            uploadedFile={uploadedFile}
            videoUrl={videoUrl}
            onFileSelect={onVideoPicked}
            onBack={() => navigate(`/projects/${id}`)}
            onNext={() => setPhase('subtitle')}
          />
        )}
        {phase === 'subtitle' && (
          <SubtitleStep
            subtitleMode={subtitleMode}
            onModeSelect={setSubtitleMode}
            isRecognizing={isRecognizing}
            recognitionDone={recognitionDone}
            onStartRecognition={() => void onSubtitleStart()}
            subtitles={subtitles}
            onSubtitlesChange={setSubtitles}
            onSubtitleFileSelect={(file, parsed) => {
              void onSubtitleFileUploaded(file, parsed);
            }}
            videoFile={uploadedFile}
            videoUrl={videoUrl}
            onReupload={() => setPhase('upload')}
            onBack={() => setPhase('upload')}
            onNext={recognitionDone ? () => setPhase('config') : undefined}
          />
        )}
        {phase === 'config' && (
          <ConfigStep
            projectType="movie"
            value={config}
            onChange={setConfig}
            onBack={() => setPhase('subtitle')}
            onReupload={() => setPhase('upload')}
            onGenerate={() => {
              setPhase('generate');
              void generate();
            }}
            generating={generating}
          />
        )}
        {phase === 'generate' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
              style={{ background: 'rgba(70,236,19,0.12)', color: '#46ec13' }}
            >
              <Wand2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold">准备好生成剪辑脚本</h3>
            <p className="text-sm text-white/55 mt-2 max-w-md">
              点击"开始生成"后，系统将自动合成解说文案，稍等片刻。
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setPhase('config')}
                className="border-white/15 bg-transparent text-white hover:bg-white/5"
              >
                返回配置
              </Button>
              <Button
                onClick={generate}
                disabled={generating}
                className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold rounded-lg px-6 brand-glow"
              >
                {generating ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-1 animate-spin" /> 生成中…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" /> 开始生成
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <GenerationProgressModal
        open={generating}
        steps={progressSteps}
        onCancel={() => {
          setGenerating(false);
          setProgressSteps([]);
          toast.info('已取消生成');
        }}
      />

      <CopywritingPreviewDialog
        open={previewOpen}
        initialText={previewText}
        onClose={() => setPreviewOpen(false)}
        onRegenerate={() => {
          setPreviewOpen(false);
          void generate();
        }}
        onConfirm={confirmPreview}
      />
    </div>
  );
}

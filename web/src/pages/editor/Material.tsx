import { useEffect, useState } from 'react';
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
import type { SubtitleLine } from '@/lib/api';
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

const mockSubtitles: SubtitleLine[] = [
  { id: 1, start: '00:00:00.000', end: '00:00:21.500', text: '吃撑了，就躺在龙椅上晒太阳。晒呀，晒呀，直至饿了。直到饿了，就再接着吃面膜，吃大饼。' },
  { id: 2, start: '00:00:22.900', end: '00:00:32.100', text: '知道了吧？这就是皇上！' },
  { id: 3, start: '00:00:45.500', end: '00:01:04.700', text: '全村一开春就断粮了，男女老少天天饿得眼睛发绿呀。那时候咱就觉得做皇帝多好啊。' },
  { id: 4, start: '00:01:04.700', end: '00:01:19.100', text: '后来真要做了皇上才明白，原来这把龙椅并没有想象中那么舒服。' },
  { id: 5, start: '00:01:19.100', end: '00:01:35.000', text: '江山是锦绣，但也是沉重的铁甲，压得人喘不过气。' },
];

const mockScript: ScriptItem[] = [
  { id: 's1', startTime: '00:00:00,000', endTime: '00:00:21,500', originalSubtitle: '吃撑了，就躺在龙椅上晒太阳…', narration: '一开场，这位皇帝就把"躺平"二字演绎到了极致——吃饱睡，睡饱吃，龙椅当床，面膜大饼轮着上。' },
  { id: 's2', startTime: '00:00:22,900', endTime: '00:00:32,100', originalSubtitle: '知道了吧？这就是皇上！', narration: '别笑，这还真是九五之尊的日常。看着荒诞，却藏着一整个王朝的倦怠。' },
  { id: 's3', startTime: '00:00:45,500', endTime: '00:01:04,700', originalSubtitle: '全村一开春就断粮了…', narration: '可镜头一转，百姓却在春荒里挨饿。民间的饥饿与宫里的慵懒，被一刀切开两个世界。' },
  { id: 's4', startTime: '00:01:04,700', endTime: '00:01:19,100', originalSubtitle: '后来真要做了皇上才明白…', narration: '少年梦里想当皇帝，以为是天堂的通行证；真坐上去才知道，这把龙椅更像一副铁打的枷。' },
  { id: 's5', startTime: '00:01:19,100', endTime: '00:01:35,000', originalSubtitle: '江山是锦绣，但也是沉重的铁甲…', narration: '锦绣江山在他肩上沉甸甸地合拢——原来最难扛的，不是敌人的刀，而是自己的那身龙袍。' },
];

export default function MaterialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project } = useOutletContext<Ctx>();

  const [phase, setPhase] = useState<Phase>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(project?.videoUrl);

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

  const onVideoPicked = (file: File | null) => {
    setUploadedFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      updateProject(id, {
        videoFileName: file.name,
        videoUrl: url,
        currentStep: 'upload',
      });
    } else {
      setVideoUrl(undefined);
      updateProject(id, { videoFileName: undefined, videoUrl: undefined });
    }
  };

  const onSubtitleStart = async () => {
    setSubtitleMode('auto');
    setIsRecognizing(true);
    try {
      await new Promise((r) => setTimeout(r, 1400));
      setSubtitles(mockSubtitles);
      setRecognitionDone(true);
    } finally {
      setIsRecognizing(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    const stepsDef: GenerationStep[] = [
      { key: 'check', label: '校验视频与配置', status: 'running' },
      { key: 'llm', label: '正在请求大模型', status: 'pending', hint: 'AI 正在创作解说文案…' },
      { key: 'parse', label: '解析生成结果', status: 'pending' },
    ];
    setProgressSteps(stepsDef);
    try {
      await new Promise((r) => setTimeout(r, 700));
      setProgressSteps((prev) =>
        prev.map((s) =>
          s.key === 'check' ? { ...s, status: 'done' } : s.key === 'llm' ? { ...s, status: 'running' } : s
        )
      );
      await new Promise((r) => setTimeout(r, 1100));
      setProgressSteps((prev) =>
        prev.map((s) =>
          s.key === 'llm' ? { ...s, status: 'done' } : s.key === 'parse' ? { ...s, status: 'running' } : s
        )
      );
      await new Promise((r) => setTimeout(r, 600));
      setProgressSteps((prev) => prev.map((s) => (s.key === 'parse' ? { ...s, status: 'done' } : s)));
      setPendingScript(mockScript);
      setPreviewText(mockScript.map((s) => s.narration).join('\n\n'));
      setGenerating(false);
      setProgressSteps([]);
      toast.success('解说文案已生成，请预览并确认');
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
      setGenerating(false);
      setProgressSteps([]);
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
            onSubtitleFileSelect={(_file, parsed) => {
              setSubtitles(parsed);
              setRecognitionDone(true);
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

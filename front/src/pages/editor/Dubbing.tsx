import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  type Project,
  type ScriptItem,
  updateProject,
} from '@/lib/projects-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Ctx = { project?: Project };

type Tier = 'basic' | 'premium';
type VoiceMode = 'builtin' | 'clone';
type AudioStatus = 'pending' | 'ready' | 'generating';

type Voice = {
  id: string;
  name: string;
  tier: Tier;
};

const BUILTIN_VOICES: Voice[] = [
  { id: 'v1', name: '齐静春', tier: 'basic' },
  { id: 'v2', name: '磁性男声', tier: 'basic' },
  { id: 'v3', name: '贾小军', tier: 'basic' },
  { id: 'v4', name: '麦克阿瑟', tier: 'basic' },
  { id: 'v5', name: '顾我电影解说', tier: 'basic' },
  { id: 'v6', name: '温柔女声', tier: 'basic' },
  { id: 'v7', name: '历史解说', tier: 'basic' },
  { id: 'v8', name: '纪录片解说', tier: 'basic' },
  { id: 'v9', name: '情感女声', tier: 'premium' },
  { id: 'v10', name: '激情热血', tier: 'premium' },
  { id: 'v11', name: '沉稳旁白', tier: 'premium' },
  { id: 'v12', name: '影视感男声', tier: 'premium' },
];

function formatTime(value: string): string {
  const match = value.match(/^(\d+):(\d+):(\d+)[.,]?(\d*)$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    const ms = match[4] ? parseInt(match[4].slice(0, 3).padEnd(3, '0'), 10) : 0;
    return `${(h * 3600 + m * 60 + s + ms / 1000).toFixed(2)}s`;
  }
  if (/^\d+(\.\d+)?s?$/.test(value)) {
    return value.endsWith('s') ? value : `${value}s`;
  }
  return value;
}

function OrangeSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 right-0 h-1.5 my-auto rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: '#ff7a3d' }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="dubbing-orange-slider relative w-full h-5 bg-transparent appearance-none cursor-pointer"
      />
    </div>
  );
}

export default function DubbingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project } = useOutletContext<Ctx>();

  const [tier, setTier] = useState<Tier>('basic');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('builtin');
  const [voiceId, setVoiceId] = useState(
    project?.config?.ttsVoice ?? BUILTIN_VOICES[0].id
  );
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);

  const initialScript = project?.scriptItems ?? [];
  const [items, setItems] = useState<ScriptItem[]>(initialScript);
  const [audioStatus, setAudioStatus] = useState<Record<string, AudioStatus>>(
    Object.fromEntries(initialScript.map((s) => [s.id, 'pending' as AudioStatus]))
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkSynth, setBulkSynth] = useState(false);

  const counts = useMemo(() => {
    const total = items.length;
    const withNarration = items.filter((i) => i.narration.trim().length > 0).length;
    const ready = Object.values(audioStatus).filter((s) => s === 'ready').length;
    return { total, narrated: withNarration, ready, pending: withNarration - ready };
  }, [items, audioStatus]);

  if (!id || !project) return null;

  const persist = (next: ScriptItem[]) => {
    setItems(next);
    updateProject(id, { scriptItems: next });
  };

  const addRow = () => {
    const row: ScriptItem = {
      id: `s-${Date.now()}`,
      startTime: '00.00s',
      endTime: '05.00s',
      originalSubtitle: '',
      narration: '',
    };
    persist([...items, row]);
  };

  const removeRow = (rowId: string) => {
    persist(items.filter((x) => x.id !== rowId));
    setAudioStatus((s) => {
      const rest = { ...s };
      delete rest[rowId];
      return rest;
    });
  };

  const genOne = async (rowId: string) => {
    setAudioStatus((s) => ({ ...s, [rowId]: 'generating' }));
    await new Promise((r) => setTimeout(r, 900));
    setAudioStatus((s) => ({ ...s, [rowId]: 'ready' }));
    toast.success('音频生成完成');
  };

  const genAll = async () => {
    if (items.length === 0) {
      toast.error('没有可生成的脚本片段');
      return;
    }
    setBulkSynth(true);
    try {
      for (const it of items) {
        if (!it.narration.trim()) continue;
        setAudioStatus((s) => ({ ...s, [it.id]: 'generating' }));
        await new Promise((r) => setTimeout(r, 350));
        setAudioStatus((s) => ({ ...s, [it.id]: 'ready' }));
      }
      toast.success(`配音生成完成`);
    } finally {
      setBulkSynth(false);
    }
  };

  const downloadScript = () => {
    const payload = items.map((s, i) => ({
      序号: i + 1,
      开始时间: s.startTime,
      结束时间: s.endTime,
      原始字幕: s.originalSubtitle,
      解说词: s.narration,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'script'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('脚本已下载');
  };

  const saveScript = () => {
    updateProject(id, {
      scriptItems: items,
      config: { ...(project.config ?? {}), ttsVoice: voiceId },
    });
    toast.success('脚本已保存');
  };

  const refresh = () => {
    toast.info('已刷新最新脚本');
  };

  const hasVideo = !!project.videoUrl;
  const visibleVoices = BUILTIN_VOICES.filter(
    (v) => tier === 'premium' || v.tier === 'basic'
  );

  return (
    <div className="container-workspace py-8 pb-36 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[2rem] font-bold">配音制作</h1>
          <p className="text-sm text-white/55 mt-1">
            管理脚本内容，生成配音音频，校准时间戳，并进行视频合成。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadScript}
            className="border-white/15 bg-transparent text-white hover:bg-white/5 h-10 px-4"
          >
            <Download className="w-4 h-4 mr-1.5" /> 下载脚本
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="border-white/15 bg-transparent text-white hover:bg-white/5 h-10 px-4"
          >
            <RefreshCcw className="w-4 h-4 mr-1.5" /> 刷新数据
          </Button>
        </div>
      </header>

      {/* 服务等级 - radio style */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex-1">
            <h3 className="font-semibold">服务等级</h3>
            <p className="text-xs text-white/55 mt-1 max-w-2xl">
              Basic 等级使用免费的 TTS 模型，不消耗 tokens；Premium 等级使用收费模型，1 个 UTF-8 字符消耗约 10 tokens，音质更好且稳定性更高。
            </p>
          </div>
          <div className="flex items-start gap-10 shrink-0">
            {(['basic', 'premium'] as Tier[]).map((t) => {
              const active = tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className="flex items-start gap-2 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      active ? 'border-[#46ec13]' : 'border-white/30'
                    )}
                  >
                    {active ? <span className="w-2 h-2 rounded-full bg-[#46ec13]" /> : null}
                  </span>
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1">
                      {t === 'basic' ? (
                        <>
                          Basic <span className="text-[#46ec13]">(免费)</span>
                        </>
                      ) : (
                        <>
                          Premium <span className="text-amber-400">(收费)</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-white/50 mt-1">
                      {t === 'basic'
                        ? '免费模型，不消耗 tokens'
                        : '1 UTF-8 字符消耗约 10 tokens'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 音色选择 */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
        <header className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(70,236,19,0.12)', color: '#46ec13' }}
          >
            <Mic className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-semibold">音色选择</h3>
            <p className="text-xs text-white/50">选择内置音色或上传自定义音色文件</p>
          </div>
        </header>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="voice-mode"
            checked={voiceMode === 'builtin'}
            onChange={() => setVoiceMode('builtin')}
            className="accent-[#46ec13]"
          />
          <span>内置音色</span>
        </label>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleVoices.map((v) => {
            const active = voiceMode === 'builtin' && voiceId === v.id;
            return (
              <button
                type="button"
                key={v.id}
                onClick={() => {
                  setVoiceMode('builtin');
                  setVoiceId(v.id);
                }}
                className={cn(
                  'text-left rounded-xl border p-5 transition relative h-[120px] flex flex-col justify-between',
                  active
                    ? 'border-[#46ec13] bg-[#46ec13]/[0.08]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                )}
              >
                {active ? (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-[#46ec13] bg-[#46ec13]/20 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#46ec13]" />
                  </span>
                ) : null}
                <div>
                  <div className="text-base font-semibold">{v.name}</div>
                  <span
                    className={cn(
                      'inline-block mt-2 text-[11px] px-2 py-0.5 rounded',
                      v.tier === 'basic'
                        ? 'bg-[#46ec13]/15 text-[#46ec13]'
                        : 'bg-amber-400/15 text-amber-400'
                    )}
                  >
                    {v.tier === 'basic' ? 'Basic' : 'Premium'}
                  </span>
                </div>
                <div className="flex justify-end">
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info(`试听：${v.name}`);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-[#46ec13] text-[#060a07]"
                  >
                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-white/50 cursor-not-allowed">
          <input
            type="radio"
            name="voice-mode"
            checked={voiceMode === 'clone'}
            onChange={() => {
              setVoiceMode('clone');
              toast.info('克隆音色能力即将上线');
            }}
            className="accent-[#46ec13]"
          />
          <span>克隆音色</span>
        </label>
      </section>

      {/* 语速 / 音量 */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="text-sm font-semibold">语速控制</div>
            <div className="text-[11px] text-white/50 mt-0.5">
              调整配音的语速，范围 0.8x - 1.4x
            </div>
          </div>
          <div className="w-[360px] flex items-center gap-3">
            <div className="flex-1">
              <OrangeSlider
                value={rate}
                min={0.8}
                max={1.4}
                step={0.05}
                onChange={setRate}
              />
            </div>
            <div className="text-sm font-mono text-white w-12 text-right">{rate.toFixed(1)}x</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-white/70" /> 音量控制
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              调整配音的音量倍数，范围 0.0x - 2.0x（1.0 = 原音量，0.5 = 减半，2.0 = 加倍）
            </div>
          </div>
          <div className="w-[360px] flex items-center gap-3">
            <div className="flex-1">
              <OrangeSlider
                value={volume}
                min={0}
                max={2}
                step={0.05}
                onChange={setVolume}
              />
            </div>
            <div className="text-sm font-mono text-white w-12 text-right">{volume.toFixed(1)}x</div>
          </div>
        </div>
      </section>

      {/* 配音脚本 table */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        {items.length === 0 ? (
          <EmptyState onAdd={addRow} onBack={() => navigate(`/projects/${id}/analysis`)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead className="text-white/50 text-left">
                <tr>
                  <th className="px-5 py-3 font-normal w-10">
                    <Checkbox
                      checked={items.length > 0 && items.every((i) => selected[i.id])}
                      onCheckedChange={(v) => {
                        const next: Record<string, boolean> = {};
                        if (v) items.forEach((i) => (next[i.id] = true));
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th className="px-3 py-3 font-normal w-14">序号</th>
                  <th className="px-3 py-3 font-normal w-28">开始时间</th>
                  <th className="px-3 py-3 font-normal w-28">结束时间</th>
                  <th className="px-3 py-3 font-normal w-[22%]">原始字幕</th>
                  <th className="px-3 py-3 font-normal">解说词</th>
                  <th className="px-3 py-3 font-normal w-24">音频状态</th>
                  <th className="px-3 py-3 font-normal w-24">音频操作</th>
                  <th className="px-3 py-3 font-normal w-16 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const st = audioStatus[row.id] ?? 'pending';
                  const hasNarration = row.narration.trim().length > 0;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-white/5 align-middle hover:bg-white/[0.02] relative"
                    >
                      <td className="relative px-5 py-5">
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#46ec13]/70" />
                        <Checkbox
                          checked={!!selected[row.id]}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [row.id]: Boolean(v) }))
                          }
                        />
                      </td>
                      <td className="px-3 py-5 text-white/70 font-mono">{idx + 1}</td>
                      <td className="px-3 py-5 text-[#46ec13] font-mono">
                        {formatTime(row.startTime)}
                      </td>
                      <td className="px-3 py-5 text-white/90 font-mono">
                        {formatTime(row.endTime)}
                      </td>
                      <td className="px-3 py-5 text-white/75 leading-relaxed">
                        {row.originalSubtitle ? (
                          <div className="line-clamp-2">{row.originalSubtitle}</div>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                      <td className="px-3 py-5 text-white/90 leading-relaxed">
                        {row.narration ? (
                          <div className="line-clamp-2">{row.narration}</div>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                      <td className="px-3 py-5">
                        <AudioStatusIcon status={st} hasNarration={hasNarration} />
                      </td>
                      <td className="px-3 py-5">
                        {hasNarration ? (
                          <button
                            type="button"
                            onClick={() => genOne(row.id)}
                            disabled={st === 'generating'}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-white/65 hover:text-[#46ec13] hover:bg-white/5 disabled:opacity-50"
                            title={st === 'ready' ? '重新生成' : '生成音频'}
                          >
                            {st === 'generating' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-white/35">原片</span>
                        )}
                      </td>
                      <td className="px-3 py-5">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => removeRow(row.id)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-white/55 hover:text-red-400 hover:bg-white/5"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Final video synthesis row — shown inside the page, above sticky footer */}
      {items.length > 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center flex-wrap gap-3">
            <Button
              size="sm"
              className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold h-10 px-4"
              onClick={() => navigate(`/projects/${id}/material`)}
            >
              <UploadCloud className="w-4 h-4 mr-1.5" />
              已选择: {project.videoFileName || project.name + '.mp4'}
            </Button>
            <Button
              size="sm"
              disabled={!hasVideo || counts.ready === 0}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold h-10 px-4 disabled:opacity-40"
              onClick={() => toast.success('已导出到剪映草稿')}
            >
              <Scissors className="w-4 h-4 mr-1.5" /> 导出到剪映草稿
            </Button>
            <Button
              size="sm"
              disabled={!hasVideo || counts.ready === 0}
              onClick={() => {
                updateProject(id, { status: 'exported' });
                toast.success('视频合成已开始');
              }}
              className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold h-10 px-4 disabled:opacity-40"
            >
              <FileAudio className="w-4 h-4 mr-1.5" /> 开始视频合成
            </Button>
            {!hasVideo ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                缺少原始视频，无法合成
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Sticky footer stats bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur">
        <div className="container-workspace py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-baseline gap-3 flex-wrap text-sm">
            <h2 className="text-base font-semibold text-white">配音脚本</h2>
            <span className="text-white/55">共 {counts.total} 项</span>
            <span className="text-white/20">|</span>
            <span className="text-white/55">解说 {counts.narrated} 项</span>
            <span className="text-white/20">|</span>
            <span className="text-[#46ec13]">已配音 {counts.ready}</span>
            <span className="text-white/20">|</span>
            <span className="text-amber-300">待配音 {Math.max(counts.narrated - counts.ready, 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={genAll}
              disabled={bulkSynth || items.length === 0}
              size="sm"
              className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold h-10 px-5 brand-glow"
            >
              {bulkSynth ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> 生成中…
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-1" /> 生成全部音频
                </>
              )}
            </Button>
            <Button
              onClick={saveScript}
              size="sm"
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/5 h-10 px-4"
            >
              <Save className="w-4 h-4 mr-1" /> 保存脚本
            </Button>
            <Button
              onClick={addRow}
              size="sm"
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/5 h-10 px-4"
            >
              <Plus className="w-4 h-4 mr-1" /> 添加
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioStatusIcon({
  status,
  hasNarration,
}: {
  status: AudioStatus;
  hasNarration: boolean;
}) {
  if (!hasNarration) {
    return <Volume2 className="w-4 h-4 text-[#46ec13]" />;
  }
  if (status === 'ready') {
    return <Volume2 className="w-4 h-4 text-[#46ec13]" />;
  }
  if (status === 'generating') {
    return <Loader2 className="w-4 h-4 text-white/60 animate-spin" />;
  }
  return <AlertTriangle className="w-4 h-4 text-amber-400" />;
}

function EmptyState({
  onAdd,
  onBack,
}: {
  onAdd: () => void;
  onBack: () => void;
}) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-4 text-sm">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(70,236,19,0.12)', color: '#46ec13' }}
      >
        <FileAudio className="w-6 h-6" />
      </div>
      <div className="font-semibold">尚未生成脚本</div>
      <p className="text-white/50 max-w-md text-center">
        请先返回「分析」页面生成剪辑脚本，再回到这里进行配音合成；或手动添加一条解说词。
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onAdd}
          variant="outline"
          className="border-white/15 bg-transparent text-white hover:bg-white/5"
        >
          <Plus className="w-4 h-4 mr-1" /> 添加一条
        </Button>
        <Button
          size="sm"
          onClick={onBack}
          className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold"
        >
          <Sparkles className="w-4 h-4 mr-1" /> 返回分析页面
        </Button>
      </div>
    </div>
  );
}

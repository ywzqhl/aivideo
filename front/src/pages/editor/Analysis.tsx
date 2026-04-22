import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  Download,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
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
import GenerationProgressModal, {
  type GenerationStep,
} from '@/components/workspace/GenerationProgressModal';

type Ctx = { project?: Project };

function newItem(): ScriptItem {
  return {
    id: `s-${Date.now()}`,
    startTime: '00.00s',
    endTime: '05.00s',
    originalSubtitle: '',
    narration: '',
  };
}

function formatTime(value: string): string {
  // Convert "00:00:00,000" or "00:00:00.000" to seconds with decimals like "137.64s"
  const match = value.match(/^(\d+):(\d+):(\d+)[.,]?(\d*)$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    const ms = match[4] ? parseInt(match[4].slice(0, 3).padEnd(3, '0'), 10) : 0;
    const total = h * 3600 + m * 60 + s + ms / 1000;
    return `${total.toFixed(2)}s`;
  }
  if (/^\d+(\.\d+)?s?$/.test(value)) {
    return value.endsWith('s') ? value : `${value}s`;
  }
  return value;
}

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project } = useOutletContext<Ctx>();
  const [items, setItems] = useState<ScriptItem[]>(project?.scriptItems ?? []);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ id: string; field: keyof ScriptItem } | null>(null);
  const [rematching, setRematching] = useState(false);
  const [rematchSteps, setRematchSteps] = useState<GenerationStep[]>([]);

  useEffect(() => {
    setItems(project?.scriptItems ?? []);
  }, [project?.id, project?.scriptItems]);

  const stats = useMemo(() => {
    const total = items.length;
    const narrated = items.filter((i) => i.narration.trim().length > 0).length;
    return { total, narrated };
  }, [items]);

  if (!id || !project) {
    return (
      <div className="container-workspace py-20 text-center text-white/60">
        项目不存在。
      </div>
    );
  }

  const persist = (next: ScriptItem[]) => {
    setItems(next);
    updateProject(id, { scriptItems: next });
  };

  const add = () => persist([...items, newItem()]);
  const remove = (rowId: string) => persist(items.filter((x) => x.id !== rowId));
  const patch = (rowId: string, patchObj: Partial<ScriptItem>) =>
    persist(items.map((x) => (x.id === rowId ? { ...x, ...patchObj } : x)));

  const copyRow = (rowId: string) => {
    const idx = items.findIndex((x) => x.id === rowId);
    if (idx === -1) return;
    const clone: ScriptItem = { ...items[idx], id: `s-${Date.now()}` };
    const next = [...items];
    next.splice(idx + 1, 0, clone);
    persist(next);
  };

  const moveRow = (rowId: string, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === rowId);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    persist(next);
  };

  const exportJson = () => {
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
    toast.success('脚本已导出');
  };

  const regenerate = async () => {
    setRematching(true);
    const steps: GenerationStep[] = [
      { key: 'upload', label: '确认视频资源并上传到对象存储', status: 'running' },
      { key: 'submit', label: '提交 智能分析 任务至后端', status: 'pending' },
      { key: 'llm', label: '等待智能模型合成解说脚本', status: 'pending', hint: 'AI 正在匹配画面，请稍候...' },
      { key: 'save', label: '自动保存脚本并跳转到分析页面', status: 'pending' },
    ];
    setRematchSteps(steps);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setRematchSteps((p) =>
        p.map((s) => (s.key === 'upload' ? { ...s, status: 'done' } : s.key === 'submit' ? { ...s, status: 'running' } : s))
      );
      await new Promise((r) => setTimeout(r, 600));
      setRematchSteps((p) =>
        p.map((s) => (s.key === 'submit' ? { ...s, status: 'done' } : s.key === 'llm' ? { ...s, status: 'running' } : s))
      );
      await new Promise((r) => setTimeout(r, 1000));
      setRematchSteps((p) =>
        p.map((s) => (s.key === 'llm' ? { ...s, status: 'done' } : s.key === 'save' ? { ...s, status: 'running' } : s))
      );
      await new Promise((r) => setTimeout(r, 500));
      setRematchSteps((p) => p.map((s) => (s.key === 'save' ? { ...s, status: 'done' } : s)));
      setRematching(false);
      setRematchSteps([]);
      toast.success('已完成画面匹配');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '匹配失败');
      setRematching(false);
      setRematchSteps([]);
    }
  };

  const next = () => {
    navigate(`/projects/${id}/dubbing`);
  };

  return (
    <div className="container-workspace py-8">
      <header className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-[2rem] font-bold">剪辑脚本编辑</h1>
          <p className="text-sm text-white/55 mt-1">项目：{project.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={exportJson}
            className="text-white/80 hover:text-white hover:bg-white/5 h-10 px-4"
          >
            <Download className="w-4 h-4 mr-1.5" /> 导出
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={regenerate}
            className="border-white/15 bg-transparent text-white hover:bg-white/5 h-10 px-4"
          >
            <Sparkles className="w-4 h-4 mr-1.5" /> 重新生成
          </Button>
          <Button
            size="sm"
            onClick={next}
            disabled={items.length === 0}
            className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold disabled:opacity-40 disabled:pointer-events-none h-10 px-6 rounded-lg brand-glow"
          >
            <ArrowRight className="w-4 h-4 mr-1.5" /> 下一步
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 flex-wrap gap-3">
          <div className="flex items-baseline gap-3">
            <h3 className="font-semibold text-base">剪辑脚本</h3>
            <span className="text-xs text-white/50">共 {stats.total} 项</span>
            {stats.narrated > 0 ? (
              <span className="text-xs text-[#46ec13]">已填解说 {stats.narrated}</span>
            ) : null}
          </div>
          <Button
            size="sm"
            onClick={add}
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/5"
          >
            <Plus className="w-4 h-4 mr-1" /> 添加
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-sm">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(70,236,19,0.12)', color: '#46ec13' }}
            >
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="font-semibold">还没有脚本数据</div>
            <p className="text-white/50 max-w-md text-center">
              点击「重新生成」可再次匹配画面，或点击下方按钮手动添加第一项。
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={add}
                variant="outline"
                className="border-white/15 bg-transparent text-white hover:bg-white/5"
              >
                <Plus className="w-4 h-4 mr-1" /> 添加第一项
              </Button>
              <Button
                size="sm"
                onClick={regenerate}
                className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold"
              >
                <RefreshCcw className="w-4 h-4 mr-1" /> 重新生成
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="text-white/50 text-left">
                <tr>
                  <th className="px-5 py-3 font-normal w-10">
                    <Checkbox
                      checked={items.length > 0 && items.every((i) => selected[i.id])}
                      onCheckedChange={(v) => {
                        const nextSel: Record<string, boolean> = {};
                        if (v) items.forEach((i) => (nextSel[i.id] = true));
                        setSelected(nextSel);
                      }}
                    />
                  </th>
                  <th className="px-3 py-3 font-normal w-14">序号</th>
                  <th className="px-3 py-3 font-normal w-28">开始时间</th>
                  <th className="px-3 py-3 font-normal w-28">结束时间</th>
                  <th className="px-3 py-3 font-normal w-[28%]">原始字幕</th>
                  <th className="px-3 py-3 font-normal">解说词</th>
                  <th className="px-3 py-3 font-normal w-36 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const isChecked = !!selected[row.id];
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-t border-white/5 align-middle transition-colors',
                        isChecked ? 'bg-[#46ec13]/[0.04]' : 'hover:bg-white/[0.02]'
                      )}
                    >
                      <td className="px-5 py-5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [row.id]: Boolean(v) }))
                          }
                        />
                      </td>
                      <td className="px-3 py-5 text-white/70 font-mono">{idx + 1}</td>
                      <EditableCell
                        value={row.startTime}
                        display={formatTime(row.startTime)}
                        isEditing={editing?.id === row.id && editing.field === 'startTime'}
                        onEditStart={() => setEditing({ id: row.id, field: 'startTime' })}
                        onEditEnd={() => setEditing(null)}
                        onChange={(v) => patch(row.id, { startTime: v })}
                        displayClass="text-[#46ec13] font-mono"
                        cellClass="w-28"
                      />
                      <EditableCell
                        value={row.endTime}
                        display={formatTime(row.endTime)}
                        isEditing={editing?.id === row.id && editing.field === 'endTime'}
                        onEditStart={() => setEditing({ id: row.id, field: 'endTime' })}
                        onEditEnd={() => setEditing(null)}
                        onChange={(v) => patch(row.id, { endTime: v })}
                        displayClass="text-white/90 font-mono"
                        cellClass="w-28"
                      />
                      <EditableCell
                        value={row.originalSubtitle}
                        display={row.originalSubtitle || '—'}
                        isEditing={editing?.id === row.id && editing.field === 'originalSubtitle'}
                        onEditStart={() => setEditing({ id: row.id, field: 'originalSubtitle' })}
                        onEditEnd={() => setEditing(null)}
                        onChange={(v) => patch(row.id, { originalSubtitle: v })}
                        displayClass={row.originalSubtitle ? 'text-white/85 leading-relaxed' : 'text-white/30'}
                        multiline
                      />
                      <EditableCell
                        value={row.narration}
                        display={row.narration || '—'}
                        isEditing={editing?.id === row.id && editing.field === 'narration'}
                        onEditStart={() => setEditing({ id: row.id, field: 'narration' })}
                        onEditEnd={() => setEditing(null)}
                        onChange={(v) => patch(row.id, { narration: v })}
                        displayClass={row.narration ? 'text-white/90 leading-relaxed' : 'text-white/30'}
                        multiline
                      />
                      <td className="px-3 py-5">
                        <div className="flex items-center justify-end gap-1">
                          <RowIcon title="复制行" onClick={() => copyRow(row.id)}>
                            <Copy className="w-3.5 h-3.5" />
                          </RowIcon>
                          <RowIcon
                            title="上移"
                            disabled={idx === 0}
                            onClick={() => moveRow(row.id, -1)}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </RowIcon>
                          <RowIcon
                            title="下移"
                            disabled={idx === items.length - 1}
                            onClick={() => moveRow(row.id, 1)}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </RowIcon>
                          <RowIcon
                            title="删除"
                            danger
                            onClick={() => remove(row.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </RowIcon>
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

      <GenerationProgressModal
        open={rematching}
        title="正在请求大模型..."
        subtitle="智能分析 · 智能分析"
        steps={rematchSteps}
        cancelLabel="取消分析"
        onCancel={() => {
          setRematching(false);
          setRematchSteps([]);
          toast.info('已取消匹配');
        }}
      />
    </div>
  );
}

function EditableCell({
  value,
  display,
  isEditing,
  onEditStart,
  onEditEnd,
  onChange,
  displayClass,
  cellClass,
  multiline,
}: {
  value: string;
  display: string;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  onChange: (v: string) => void;
  displayClass?: string;
  cellClass?: string;
  multiline?: boolean;
}) {
  return (
    <td className={cn('px-3 py-5', cellClass)}>
      {isEditing ? (
        multiline ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onEditEnd}
            className="w-full min-h-[60px] bg-[#0f1611] border border-[#46ec13]/40 rounded-md px-2 py-1.5 text-sm text-white/90 resize-none focus:outline-none"
          />
        ) : (
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onEditEnd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditEnd();
            }}
            className="w-full bg-[#0f1611] border border-[#46ec13]/40 rounded-md h-8 px-2 text-xs font-mono text-white focus:outline-none"
          />
        )
      ) : (
        <button
          type="button"
          onClick={onEditStart}
          className={cn('text-left w-full cursor-text', displayClass)}
        >
          {display}
        </button>
      )}
    </td>
  );
}

function RowIcon({
  onClick,
  title,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-8 h-8 rounded-md flex items-center justify-center transition',
        disabled
          ? 'text-white/20 cursor-not-allowed'
          : danger
            ? 'text-white/55 hover:text-red-400 hover:bg-white/5'
            : 'text-white/55 hover:text-white hover:bg-white/5'
      )}
    >
      {children}
    </button>
  );
}

import { Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GenerationStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface GenerationStep {
  key: string;
  label: string;
  status: GenerationStepStatus;
  hint?: string;
}

interface GenerationProgressModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  steps: GenerationStep[];
  onCancel?: () => void;
  cancelDisabled?: boolean;
}

export default function GenerationProgressModal({
  open,
  title = '正在请求大模型',
  subtitle = 'AI 正在创作文案，请稍候…',
  steps,
  onCancel,
  cancelDisabled,
}: GenerationProgressModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[#0B110D] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#46ec13]/10 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-[#46ec13] animate-pulse" />
          </div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {steps.map((s) => (
            <div
              key={s.key}
              className={cn(
                'flex items-start gap-3 px-3 py-2.5 rounded-lg border',
                s.status === 'running' && 'border-[#46ec13]/30 bg-[#46ec13]/[0.05]',
                s.status === 'done' && 'border-white/[0.08] bg-white/[0.02]',
                s.status === 'pending' && 'border-white/[0.04] bg-transparent',
                s.status === 'error' && 'border-red-500/30 bg-red-500/[0.05]'
              )}
            >
              <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                {s.status === 'done' ? (
                  <span className="w-5 h-5 rounded-full bg-[#46ec13] text-[#060a07] flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                ) : s.status === 'running' ? (
                  <Loader2 className="w-5 h-5 text-[#46ec13] animate-spin" />
                ) : s.status === 'error' ? (
                  <span className="w-5 h-5 rounded-full border border-red-500 text-red-500 flex items-center justify-center text-xs">
                    !
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-600 mx-auto" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium',
                    s.status === 'running' && 'text-[#46ec13]',
                    s.status === 'done' && 'text-white',
                    s.status === 'pending' && 'text-slate-500',
                    s.status === 'error' && 'text-red-400'
                  )}
                >
                  {s.label}
                </div>
                {s.hint ? (
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{s.hint}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {onCancel ? (
          <div className="px-6 py-4 border-t border-white/[0.06] flex justify-center">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={cancelDisabled}
              className="border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.05]"
            >
              取消生成
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

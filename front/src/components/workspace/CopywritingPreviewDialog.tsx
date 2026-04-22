import { useEffect, useState } from 'react';
import { X, RefreshCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopywritingPreviewDialogProps {
  open: boolean;
  initialText?: string;
  onClose: () => void;
  onRegenerate?: () => void;
  onConfirm: (text: string) => void;
  regenerating?: boolean;
}

export default function CopywritingPreviewDialog({
  open,
  initialText = '',
  onClose,
  onRegenerate,
  onConfirm,
  regenerating,
}: CopywritingPreviewDialogProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-[#0B110D] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#46ec13]" />
            <h2 className="text-base font-semibold text-white">文案预览</h2>
            <span className="text-xs text-slate-500">{text.length} 字符</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-80 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm text-slate-100 leading-relaxed resize-none focus:outline-none focus:border-[#46ec13]/50 focus:ring-1 focus:ring-[#46ec13]/20"
            placeholder="AI 生成的解说文案将显示在此处..."
          />
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
          {onRegenerate ? (
            <Button
              variant="outline"
              onClick={onRegenerate}
              disabled={regenerating}
              className="border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.05] gap-2"
            >
              <RefreshCcw className={regenerating ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
              {regenerating ? '重新生成中…' : '重新生成'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-300 hover:text-white hover:bg-white/[0.05]"
            >
              取消
            </Button>
            <Button
              onClick={() => onConfirm(text)}
              className="bg-[#46ec13] hover:bg-[#37c00c] text-[#060a07] font-semibold rounded-lg px-6"
            >
              继续匹配
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

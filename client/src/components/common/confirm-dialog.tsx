import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-xs bg-black border border-border p-5 mx-4 shadow-2xl"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-1.5 ${variant === 'danger' ? 'text-bearish bg-bearish/10' : 'text-accent bg-accent/10'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white">{title}</h3>
                {description && (
                  <p className="text-[10px] font-mono text-neutral mt-1 leading-relaxed">{description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest text-neutral border border-border hover:text-white hover:border-white/30 transition-colors"
              >
                {cancelLabel || t('cancel')}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  variant === 'danger'
                    ? 'bg-bearish text-white hover:bg-bearish/80'
                    : 'bg-accent text-black hover:bg-accent/80'
                }`}
              >
                {confirmLabel || t('confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

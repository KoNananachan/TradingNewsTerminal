import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { X, Mail, Shield } from 'lucide-react';

type Step = 'choose' | 'email-input' | 'email-verify';

const hasGoogleOAuth = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function LoginModal() {
  const t = useT();
  const open = useAuthStore((s) => s.loginModalOpen);
  const setOpen = useAuthStore((s) => s.setLoginModalOpen);
  const { loginWithGoogle, sendEmailCode, verifyEmailCode } = useAuthActions();

  const [step, setStep] = useState<Step>(hasGoogleOAuth ? 'choose' : 'email-input');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setStep(hasGoogleOAuth ? 'choose' : 'email-input');
    setEmail('');
    setCode('');
    setError('');
  };

  const handleSendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('enterValidEmail'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendEmailCode(email);
      setStep('email-verify');
    } catch (err: any) {
      setError(err.message || t('sendCodeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError(t('enterDigitCode'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyEmailCode(email, code);
    } catch (err: any) {
      setError(err.message || t('verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={close}>
      <div
        className="relative w-full max-w-sm bg-black border border-border p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={close}
          className="absolute top-3 right-3 text-neutral hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-black uppercase tracking-widest text-accent">
            {t('login')}
          </h2>
        </div>

        {/* Google Login */}
        {step === 'choose' && (
          <>
            {hasGoogleOAuth && (
              <>
                <div className="mb-4 flex justify-center">
                  <GoogleLogin
                    onSuccess={(resp) => {
                      if (resp.credential) {
                        loginWithGoogle(resp.credential).catch((err) =>
                          setError(err.message || t('googleLoginFailed')),
                        );
                      }
                    }}
                    onError={() => setError(t('googleLoginFailed'))}
                    theme="filled_black"
                    shape="rectangular"
                    size="large"
                    width="320"
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral">{t('or')}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            {/* Email */}
            <button
              onClick={() => setStep('email-input')}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-border bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:border-accent hover:text-accent"
            >
              <Mail className="w-4 h-4" />
              {t('continueWithEmail')}
            </button>
          </>
        )}

        {/* Email input step */}
        {step === 'email-input' && (
          <>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral mb-1.5">
              {t('emailAddress')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
              placeholder={t('emailPlaceholder')}
              autoFocus
              className="w-full bg-black border border-border px-3 py-2.5 text-sm font-mono text-white placeholder:text-neutral/30 mb-3 focus:border-accent outline-none"
            />
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="w-full py-2.5 bg-accent text-black text-[11px] font-black uppercase tracking-widest hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? t('sending') : t('sendCode')}
            </button>
            {hasGoogleOAuth && (
              <button
                onClick={() => { setStep('choose'); setError(''); }}
                className="w-full mt-2 py-1.5 text-[10px] text-neutral hover:text-white uppercase tracking-widest"
              >
                {t('back')}
              </button>
            )}
          </>
        )}

        {/* Code verify step */}
        {step === 'email-verify' && (
          <>
            <p className="text-[10px] text-neutral mb-3 font-mono">
              {t('codeSentTo')} <span className="text-accent">{email}</span>
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="000000"
              autoFocus
              maxLength={6}
              className="w-full bg-black border border-border px-3 py-2.5 text-center text-lg font-mono text-white tracking-[0.5em] placeholder:text-neutral/30 mb-3 focus:border-accent outline-none"
            />
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full py-2.5 bg-accent text-black text-[11px] font-black uppercase tracking-widest hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? t('verifying') : t('verify')}
            </button>
            <button
              onClick={() => { setStep('email-input'); setCode(''); setError(''); }}
              className="w-full mt-2 py-1.5 text-[10px] text-neutral hover:text-white uppercase tracking-widest"
            >
              {t('back')}
            </button>
          </>
        )}

        {/* Terms consent note */}
        {step !== 'email-verify' && (
          <p className="mt-4 text-[9px] font-mono text-neutral/50 text-center leading-relaxed">
            {t('cookieConsent')}{' '}
            <a href="https://github.com/KoNananachan/Neuberg/blob/main/TERMS_OF_SERVICE.md" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent">{t('termsOfService')}</a>
            {' '}{t('and')}{' '}
            <a href="https://github.com/KoNananachan/Neuberg/blob/main/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent">{t('privacyPolicy')}</a>.
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 text-[10px] font-mono text-bearish text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

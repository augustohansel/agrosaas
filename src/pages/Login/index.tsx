import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AuthError } from '@supabase/supabase-js';
import { AlertCircle, ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2, LockKeyhole, Sprout } from 'lucide-react';
import { supabase } from '../../services/supabase';
import styles from './styles.module.css';

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark}><Sprout size={24} aria-hidden="true" /></span>
      <span>Gestia</span>
    </div>
  );
}

function loginError(error: AuthError) {
  if (error.code === 'invalid_credentials') {
    return 'Confira seu e-mail e sua senha e tente novamente.';
  }
  if (error.code === 'email_not_confirmed') {
    return 'Confirme seu e-mail pelo link recebido para acessar o painel.';
  }
  if (error.status === 429) {
    return 'Muitas tentativas de acesso. Aguarde um momento e tente novamente.';
  }
  return 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.';
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError(loginError(result.error));
    } catch {
      setError('Não foi possível conectar ao Gestia. Tente novamente em instantes.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className={styles.container} lang="pt-BR">
      <main className={styles.formSection}>
        <div className={styles.formTop}>
          <Brand />
        </div>
        <div className={styles.formContainer}>
          <header className={styles.formHeader}>
            <h1 className={styles.formTitle}>Bem-vindo<br />de volta<span>.</span></h1>
            <p className={styles.formSubtitle}>Entre para acompanhar sua fazenda.</p>
          </header>
          <form className={styles.form} onSubmit={handleLogin} aria-busy={loading}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="email">E-mail</label>
              <div className={styles.inputWrapper}>
                <input className={styles.input} id="email" name="email" type="email" autoComplete="username"
                  autoCapitalize="none" spellCheck={false} placeholder="seu@email.com" required
                  value={email} disabled={loading} onChange={event => { setEmail(event.target.value); setError(''); }} />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="password">Senha</label>
              <div className={styles.inputWrapper}>
                <input className={`${styles.input} ${styles.passwordInput}`} id="password" name="password"
                  type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha"
                  value={password} required disabled={loading} onChange={event => { setPassword(event.target.value); setError(''); }} />
                <button className={styles.toggleButton} type="button" disabled={loading} aria-controls="password"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(visible => !visible)}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error && <div role="alert" className={styles.errorBox}><AlertCircle size={17} aria-hidden="true" /><span>{error}</span></div>}
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? <>Entrando… <Loader2 size={18} className={styles.spinner} aria-hidden="true" /></>
                : <>Entrar <ArrowRight size={18} aria-hidden="true" /></>}
            </button>
          </form>
          <div className={styles.divider}>ou</div>
          <Link to="/demo" className={styles.demoLink}>Explorar demonstração <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <footer className={styles.formFooter}><LockKeyhole size={14} aria-hidden="true" /> Acesso protegido</footer>
      </main>
      <aside className={styles.banner} aria-label="Gestão da fazenda">
        <svg className={styles.inkFilter} aria-hidden="true" focusable="false">
          <defs>
            <filter id="lavoura-verde" colorInterpolationFilters="sRGB">
              {/* Soften the scan lines and map the photo's shadows and highlights to green and cream. */}
              <feGaussianBlur stdDeviation="0 .85" edgeMode="duplicate" />
              <feComponentTransfer>
                <feFuncR type="gamma" amplitude="1.9" exponent=".7" offset="-.2" />
                <feFuncG type="gamma" amplitude="1.9" exponent=".7" offset="-.2" />
              </feComponentTransfer>
              <feColorMatrix type="matrix" values="
                .67 .19 0 0 .12
                .51 .13 0 0 .32
                .56 .16 0 0 .20
                0   0   0 1 0" />
            </filter>
          </defs>
        </svg>
        <video className={styles.bannerImage} poster="/login-lavoura-poster.webp" autoPlay muted loop playsInline aria-hidden="true">
          <source src="/login-lavoura.mp4" type="video/mp4" media="(prefers-reduced-motion: no-preference)" />
        </video>
        <div className={styles.bannerContent}>
          <p className={styles.bannerSubtitle}>Gestão da fazenda</p>
          <p className={styles.bannerTitle}>Do talhão à<br /><em>colheita.</em></p>
        </div>
      </aside>
    </div>
  );
}

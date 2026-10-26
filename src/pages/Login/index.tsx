import { useState } from 'react';
import {
  Tractor,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import styles from './styles.module.css';

/* Vista aérea estilizada de talhões: o "hero" do painel */
function FieldsMap() {
  return (
    <svg
      className={styles.map}
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="rows" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <rect width="9" height="9" fill="none" />
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(0,0,0,0.16)" strokeWidth="3" />
        </pattern>
        <pattern id="rowsAlt" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)">
          <rect width="9" height="9" fill="none" />
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(0,0,0,0.14)" strokeWidth="3" />
        </pattern>
      </defs>

      <g stroke="#12301f" strokeWidth="6" strokeLinejoin="round">
        <polygon points="0,0 260,0 230,210 0,190" fill="#2f6b45" />
        <polygon points="260,0 600,0 600,170 230,210" fill="#c9a43f" />
        <polygon points="0,190 230,210 205,430 0,400" fill="#3d7a52" />
        <polygon points="230,210 600,170 600,420 205,430" fill="#235a38" />
        <polygon points="0,400 205,430 190,640 0,620" fill="#b88f35" />
        <polygon points="205,430 600,420 600,650 190,640" fill="#2d6644" />
        <polygon points="0,620 190,640 170,800 0,800" fill="#7d6236" />
        <polygon points="190,640 600,650 600,800 170,800" fill="#2a5c3d" />
      </g>

      {/* Linhas de plantio */}
      <g opacity="0.9">
        <polygon points="0,0 260,0 230,210 0,190" fill="url(#rows)" />
        <polygon points="260,0 600,0 600,170 230,210" fill="url(#rowsAlt)" />
        <polygon points="0,190 230,210 205,430 0,400" fill="url(#rowsAlt)" />
        <polygon points="230,210 600,170 600,420 205,430" fill="url(#rows)" />
        <polygon points="0,400 205,430 190,640 0,620" fill="url(#rows)" />
        <polygon points="190,640 600,650 600,800 170,800" fill="url(#rowsAlt)" />
      </g>

      {/* Pivô central */}
      <circle cx="400" cy="540" r="104" fill="#5a9a67" stroke="#12301f" strokeWidth="4" />
      <circle cx="400" cy="540" r="70" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <line x1="400" y1="540" x2="478" y2="468" stroke="#eef3ea" strokeWidth="3" strokeLinecap="round" />
      <circle cx="400" cy="540" r="6" fill="#eef3ea" />
    </svg>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('E-mail ou senha incorretos. Confira os dados e tente novamente.');
    }

    setLoading(false);
  }

  return (
    <div className={styles.container}>
      {/* Esquerda: vista aérea da fazenda */}
      <aside className={styles.banner}>
        <FieldsMap />

        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Tractor size={22} />
          </span>
          AgroSaaS
        </div>

        <div className={styles.bannerContent}>
          <h1 className={styles.bannerTitle}>Sua fazenda inteira, talhão por talhão.</h1>
          <p className={styles.bannerSubtitle}>
            Acompanhe custos em um só lugar e decida com os números na mão.
          </p>
          <div className={styles.bannerFooter}>
            &copy; {new Date().getFullYear()} AgroSaaS. Todos os direitos reservados.
          </div>
        </div>
      </aside>

      {/* Direita: formulário */}
      <main className={styles.formSection}>
        <div className={styles.formContainer}>
          <div className={styles.mobileBrand}>
            <span className={styles.brandMark}>
              <Tractor size={22} />
            </span>
            AgroSaaS
          </div>

          <header className={styles.formHeader}>
            <h2 className={styles.formTitle}>Entrar na sua conta</h2>
            <p className={styles.formSubtitle}>
              Use o e-mail e a senha do seu cadastro para abrir o painel.
            </p>
          </header>

          <form className={styles.form} onSubmit={handleLogin} noValidate={false}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                E-mail
              </label>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="contato@fazenda.com"
                  aria-invalid={!!error}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Senha
              </label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${styles.input} ${styles.passwordInput}`}
                  placeholder="Digite sua senha"
                  aria-invalid={!!error}
                  required
                />
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className={styles.errorBox} role="alert">
                <AlertCircle size={18} />
                <p style={{ margin: 0 }}>{error}</p>
              </div>
            )}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={20} className={styles.spinner} /> Entrando...
                </>
              ) : (
                <>
                  Entrar <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
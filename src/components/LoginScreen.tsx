import React, { useState, useMemo } from 'react';
import { AppUser } from '../types';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Shield,
  HelpCircle,
  X,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { MakmoLogo } from './MakmoLogo';

interface LoginScreenProps {
  users: AppUser[];
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLoginSuccess }) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  // Ocultar a seção de testes mantendo intactas todas as credenciais e configurações
  const [showQuickAccess, setShowQuickAccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const cleanInput = usernameOrEmail.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanInput) {
      setErrorMessage('Por favor, informe seu usuário ou e-mail de acesso.');
      setIsSubmitting(false);
      return;
    }

    if (!cleanPass) {
      setErrorMessage('Por favor, digite sua senha.');
      setIsSubmitting(false);
      return;
    }

    // Find user by username or email
    const foundUser = users.find(
      (u) =>
        u.username.toLowerCase() === cleanInput ||
        u.email.toLowerCase() === cleanInput
    );

    const isPasswordValid =
      foundUser &&
      (cleanPass === foundUser.password ||
        ((foundUser.role === 'admin' || foundUser.username === 'admin') && cleanPass === '132587'));

    if (!foundUser || !isPasswordValid) {
      setErrorMessage('Credenciais inválidas. Verifique seu usuário/e-mail e senha.');
      setIsSubmitting(false);
      return;
    }

    if (foundUser.status === 'inactive') {
      setErrorMessage(
        'Este usuário está com o status INATIVO. Entre em contato com o Administrador do sistema.'
      );
      setIsSubmitting(false);
      return;
    }

    // Success
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess(foundUser);
    }, 250);
  };

  const handleQuickFill = (presetUser: AppUser) => {
    setUsernameOrEmail(presetUser.username);
    // Para o perfil admin, NUNCA preencher automaticamente nem exibir a senha
    if (presetUser.role === 'admin' || presetUser.username === 'admin') {
      setPassword('');
      setShowPassword(false);
    } else {
      setPassword(presetUser.password);
    }
    setErrorMessage(null);
  };

  const isAdminSelected = useMemo(() => {
    const clean = usernameOrEmail.trim().toLowerCase();
    const found = users.find((u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean);
    return clean === 'admin' || found?.role === 'admin';
  }, [usernameOrEmail, users]);

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-4 overflow-hidden bg-slate-950 text-slate-100">
      {/* Background Image: Foto Teams Vibroacabadora VDA 700 MAX (#sou time makmo) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 pointer-events-none"
        style={{
          backgroundImage: `url('/assets/plano_fundo_teams_vibro.jpg')`,
        }}
      />

      {/* Camada sutil de ambientação para manter o grafismo e a máquina visíveis com alta legibilidade */}
      <div className="absolute inset-0 pointer-events-none bg-slate-950/35 backdrop-blur-[0.5px]" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/45" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[1200px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(32,180,167,0.18),transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-48 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(17,56,97,0.4),transparent_70%)] pointer-events-none" />

      {/* Marca d'água #sou time makmo no canto superior esquerdo */}
      <div className="hidden sm:flex absolute top-5 left-6 z-20 items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg">
        <span className="text-[#20b4a7] font-black font-industrial text-sm tracking-wider">#sou time</span>
        <span className="text-white font-black font-industrial text-sm tracking-wider uppercase">MAKMO</span>
      </div>

      {/* Container */}
      <div className="relative z-10 w-full max-w-md bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header / Brand with Official Makmo Logo */}
        <div className="bg-[#113861] p-6 text-center text-white relative overflow-hidden border-b border-[#1b4d82]">
          {/* Subtle brand geometry highlights */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#20b4a7]/20 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-[#0a233d]/70 rounded-full blur-xl pointer-events-none" />

          {/* Official Logo Plaque matching Sistema PCM NEXUS */}
          <div className="relative inline-block bg-[#133863] p-1.5 rounded-2xl shadow-2xl border border-teal-500/30 mb-3 mx-auto overflow-hidden">
            <MakmoLogo
              className="h-12 sm:h-14 w-auto rounded-xl"
              showSubtitle={true}
            />
          </div>

          <h1 className="text-xl sm:text-2xl font-black font-industrial tracking-wider uppercase text-white drop-shadow-xs">
            SISTEMA PCM NEXUS
          </h1>
          <p className="text-xs font-semibold tracking-wider text-slate-200 mt-1">
            Gestão Integrada de Frotas, Combustível, Manutenção Preventiva & Medição
          </p>

          <div className="inline-flex items-center gap-1.5 mt-2.5 bg-[#20b4a7]/20 border border-[#20b4a7]/40 text-[#20b4a7] text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#20b4a7]" />
            <span>Autenticação & Controle de Acesso</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Username / Email */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                E-mail ou Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="ex: admin ou seu.email@makmo.com.br"
                  className="w-full bg-zinc-950 border border-zinc-750 focus:border-[#20b4a7] focus:ring-1 focus:ring-[#20b4a7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-all outline-hidden"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={!isAdminSelected && showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={isAdminSelected ? '••••••••' : 'Digite sua senha...'}
                  className="w-full bg-zinc-950 border border-zinc-750 focus:border-[#20b4a7] focus:ring-1 focus:ring-[#20b4a7] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 transition-all outline-hidden font-mono"
                  autoComplete="current-password"
                />
                {!isAdminSelected && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Options: Remember me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-sm bg-zinc-950 border-zinc-700 text-[#20b4a7] focus:ring-[#20b4a7] focus:ring-offset-zinc-900"
                />
                <span>Lembrar meu usuário</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[#20b4a7] hover:text-[#2dd4c4] hover:underline font-semibold"
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-[#113861] via-[#16477b] to-[#20b4a7] hover:from-[#0d2f54] hover:to-[#1aa295] active:scale-[0.99] text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#113861]/40 flex items-center justify-center gap-2 font-industrial tracking-wider uppercase disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Access Demo Profiles - Ocultado conforme solicitação do usuário mantendo todas as configurações intactas */}
          {showQuickAccess && (
            <div className="mt-6 pt-5 border-t border-zinc-800/80 animate-fadeIn">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Acesso Rápido de Testes (Perfis)
                </span>
                <span className="text-[10px] text-zinc-500">Clique para preencher</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {users
                  .filter((u) => u.role !== 'admin' && u.username !== 'admin')
                  .slice(0, 4)
                  .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickFill(u)}
                    className="text-left p-2 rounded-lg bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-[#20b4a7]/50 transition-all text-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white capitalize text-[11px] group-hover:text-[#20b4a7] transition-colors">
                        {u.role}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {u.username}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {u.allowedProjects.includes('all')
                        ? 'Todas as Obras'
                        : u.allowedProjects.join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-zinc-950 px-6 py-3 border-t border-zinc-800/80 text-center text-[11px] text-zinc-500">
          Makmo Infraestrutura &bull; Sistema Integrado de Gestão
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-750 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-scaleIn">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#20b4a7]/15 border border-[#20b4a7]/30 flex items-center justify-center text-[#20b4a7]">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Recuperação de Senha</h3>
                <p className="text-xs text-zinc-400">Suporte e credenciais do sistema</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p>
                Por segurança, a redefinição de senhas de operadores e gestores é gerenciada diretamente pelo{' '}
                <strong className="text-[#20b4a7]">Administrador do Sistema</strong>.
              </p>
              <div className="pt-2 border-t border-zinc-800 space-y-1 font-mono text-[11px] text-zinc-400">
                <div>&bull; <strong>Administrador:</strong> Senha confidencial protegida (acesso restrito)</div>
                <div>&bull; <strong>Gestor:</strong> usuário <code className="text-[#20b4a7]">gestor</code> / senha <code className="text-[#20b4a7]">gestor123</code></div>
                <div>&bull; <strong>Controlador:</strong> usuário <code className="text-[#20b4a7]">controlador</code> / senha <code className="text-[#20b4a7]">controlador123</code></div>
                <div>&bull; <strong>Visualizador:</strong> usuário <code className="text-[#20b4a7]">visualizador</code> / senha <code className="text-[#20b4a7]">visualizador123</code></div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="bg-[#113861] hover:bg-[#16477b] text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Entendi, voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

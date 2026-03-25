import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, AlertTriangle, CheckCircle } from 'lucide-react';

export function ChangePassword() {
    const { t } = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { changePassword, forcePasswordChange, logout } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords
        if (newPassword.length < 6) {
            setError(t('changePassword.errors.minLength'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('changePassword.errors.mismatch'));
            return;
        }

        if (currentPassword === newPassword) {
            setError(t('changePassword.errors.sameAsCurrent'));
            return;
        }

        setLoading(true);

        try {
            await changePassword(currentPassword, newPassword);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('changePassword.errors.failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">
                        <span className="text-accent-red">Warehouse</span>
                        <span className="text-white">Core</span>
                    </h1>
                </div>

                {/* Card */}
                <div className="glass-dark p-8 rounded-xl border border-white/10">
                    {/* Force Change Warning */}
                    {forcePasswordChange && (
                        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-yellow-400 font-medium">{t('changePassword.forceTitle')}</p>
                                <p className="text-yellow-400/80 text-sm mt-1">
                                    {t('changePassword.forceDescription')}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-6">
                        <KeyRound className="w-6 h-6 text-accent-red" />
                        <h2 className="text-2xl font-bold text-white">{t('changePassword.title')}</h2>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                {t('changePassword.currentPassword')}
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                disabled={loading}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-red focus:border-transparent disabled:opacity-50"
                                placeholder={t('changePassword.passwordPlaceholder')}
                                autoComplete="current-password"
                            />
                        </div>

                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                {t('changePassword.newPassword')}
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                disabled={loading}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-red focus:border-transparent disabled:opacity-50"
                                placeholder={t('changePassword.newPasswordPlaceholder')}
                                autoComplete="new-password"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                {t('changePassword.confirmPassword')}
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-red focus:border-transparent disabled:opacity-50"
                                placeholder={t('changePassword.confirmPasswordPlaceholder')}
                                autoComplete="new-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-accent-red hover:bg-accent-red/80 disabled:bg-accent-red/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    {t('changePassword.changing')}
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    {t('changePassword.title')}
                                </>
                            )}
                        </button>
                    </form>

                    {forcePasswordChange && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={handleLogout}
                                className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
                            >
                                {t('changePassword.logoutLater')}
                            </button>
                        </div>
                    )}

                    {!forcePasswordChange && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
                            >
                                {t('changePassword.backToOverview')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        WarehouseCore © 2025
                    </p>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail, verifyWhatsapp, resendEmailVerification, resendWhatsappVerification } from '../services/api';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';

interface VerifyLandingProps {
  type: 'email' | 'whatsapp';
}

export const VerifyLanding: React.FC<VerifyLandingProps> = ({ type }) => {
  const [searchParams] = useSearchParams();
  const urlToken = (searchParams.get('token') || '').trim();
  const navigate = useNavigate();
  const { currentUser, dispatch, refreshData } = useData();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Handle Resend Timer
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(p => p - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      let res;
      if (type === 'email') {
        res = await resendEmailVerification();
      } else {
        res = await resendWhatsappVerification();
      }
      if (res.success) {
        setSuccessMessage(`A new verification code has been sent to your ${type === 'email' ? 'email' : 'WhatsApp'}.`);
        setResendTimer(60);
      } else {
        setErrorMessage(res.message || 'Failed to resend verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || successMessage) return;

    const hasAuthToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('authToken'));

    if (!urlToken && !currentUser && !hasAuthToken) {
      setErrorMessage(
        `Verification token is missing. Please open the verification link sent to your ${type === 'email' ? 'email' : 'WhatsApp'} or log in to your account.`
      );
      return;
    }

    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the exact 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      let res;
      if (type === 'email') {
        res = await verifyEmail(urlToken || undefined, code);
      } else {
        res = await verifyWhatsapp(urlToken || undefined, code);
      }

      if (res.success) {
        const defaultSuccess = type === 'email' 
          ? 'Email verified successfully! Redirecting to your dashboard. Please wait...' 
          : 'WhatsApp verified successfully! Redirecting to your dashboard. Please wait...';
        
        setSuccessMessage(defaultSuccess);

        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('authToken', res.token);
        }
        if (res.data) {
          dispatch({ type: 'UPDATE_USER', payload: res.data });
          dispatch({ type: 'SET_CURRENT_USER', payload: { user: res.data, token: res.token } });
        }

        try {
          await refreshData(true);
        } catch (refreshErr) {
          console.warn('Dashboard data refresh encountered an error:', refreshErr);
        }

        // Ensure success message remains visible for at least 2.5 seconds before navigation
        await new Promise(resolve => setTimeout(resolve, 2500));
        navigate('/member');
      } else {
        setErrorMessage(res.message || 'Verification failed. Please check your code.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden animate-fade-in p-6 sm:p-8 space-y-6">
        
        <div className="text-center space-y-2">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${type === 'email' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
            {type === 'email' ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
            {type === 'email' ? 'Email Verification' : 'WhatsApp Verification'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please enter the exact 6-digit OTP received via {type === 'email' ? 'email' : 'WhatsApp'}.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
              required
              autoFocus
              disabled={loading || Boolean(successMessage)}
            />
          </div>

          <Button type="submit" className="w-full py-3 text-sm font-bold shadow-lg" loading={loading} disabled={Boolean(successMessage)}>
            Verify {type === 'email' ? 'Email' : 'WhatsApp'}
          </Button>

          <div className="text-right pt-1">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || loading || Boolean(successMessage)}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
            >
              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : `Resend ${type === 'email' ? 'Email' : 'WhatsApp'} Code`}
            </button>
          </div>
        </form>

        {successMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-semibold animate-fade-in border border-emerald-200 dark:border-emerald-800">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold animate-fade-in border border-red-200 dark:border-red-800">
            {errorMessage}
          </div>
        )}

        <div className="pt-2 border-t dark:border-gray-800 text-center">
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">SmartExn Security Gate</span>
        </div>
      </div>
    </div>
  );
};

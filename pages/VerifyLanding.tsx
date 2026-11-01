import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyEmail, verifyWhatsapp } from '../services/api';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';

interface VerifyLandingProps {
  type: 'email' | 'whatsapp';
}

export const VerifyLanding: React.FC<VerifyLandingProps> = ({ type }) => {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState('');
  const navigate = useNavigate();
  const { dispatch } = useData();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const extractToken = (raw: string) => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (trimmed.includes('token=')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        return url.searchParams.get('token') || trimmed;
      } catch {
        const match = trimmed.match(/token=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : trimmed;
      }
    }
    return trimmed;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenToUse = extractToken(urlToken || tokenInput);
    if (!tokenToUse) {
      setErrorMessage('Verification link token is required. Please open the link from your message or paste it below.');
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
          res = await verifyEmail(tokenToUse, code);
        } else {
          res = await verifyWhatsapp(tokenToUse, code);
        }

        if (res.success) {
          setSuccessMessage(res.message || `${type === 'email' ? 'Email' : 'WhatsApp'} verified successfully!`);
          if (res.token) {
            localStorage.setItem('token', res.token);
            localStorage.setItem('authToken', res.token);
          }
          if (res.data) {
            dispatch({ type: 'UPDATE_USER', payload: res.data });
          }
          setTimeout(() => {
            navigate('/member');
          }, 2000);
        } else {
          setErrorMessage(res.message || 'Verification failed. Please check your code.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden p-8 space-y-6 text-center">
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
          {type === 'email' ? 'Email Verification' : 'WhatsApp Verification'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {urlToken 
            ? `Please enter the 6-digit OTP received via ${type}.` 
            : `Please enter the verification link/token and 6-digit OTP received via ${type}.`}
        </p>
        
        <form onSubmit={handleVerify} className="space-y-4">
            {!urlToken && (
              <input
                type="text"
                placeholder="Paste verification link or token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <input
                type="text"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-4 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
            />
            <Button type="submit" className="w-full" loading={loading}>Verify</Button>
        </form>

        {successMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-semibold">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

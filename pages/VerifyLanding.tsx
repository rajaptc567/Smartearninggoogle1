import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyEmail, verifyWhatsapp } from '../services/api';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';

interface VerifyLandingProps {
  type: 'email' | 'whatsapp';
}

export const VerifyLanding: React.FC<VerifyLandingProps> = ({ type }) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { dispatch } = useData();

  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        setLoading(false);
        setErrorMessage('Verification token is missing or invalid.');
        return;
      }

      try {
        let res;
        if (type === 'email') {
          res = await verifyEmail(token, true);
        } else {
          res = await verifyWhatsapp(token, true);
        }

        if (res.success) {
          setSuccessMessage(res.message || `${type === 'email' ? 'Email' : 'WhatsApp'} verified successfully!`);
          if (res.token) {
            localStorage.setItem('token', res.token);
          }
          if (res.data) {
            dispatch({ type: 'UPDATE_USER', payload: res.data });
          }
          setTimeout(() => {
            navigate('/member');
          }, 2000);
        } else {
          setErrorMessage(res.message || 'Verification failed. Link may have expired.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    runVerification();
  }, [token, type, dispatch, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden p-8 space-y-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
          {type === 'email' ? 'Email Verification' : 'WhatsApp Verification'}
        </h2>

        {loading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Verifying your secure token...</p>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-semibold">
            {successMessage}
            <p className="text-xs mt-2 text-gray-500">Redirecting to your dashboard...</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold">
            {errorMessage}
            <div className="mt-4">
              <Link to="/member">
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

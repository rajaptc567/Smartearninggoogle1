
import { useData } from './useData';
import { formatCurrency as formatCurrencyUtil } from '../utils/formatting';
import { Currency } from '../types';

export const useCurrency = () => {
    const { state, dispatch } = useData();
    const { selectedCurrency, currentUser } = state;

    const setSelectedCurrency = (currency: Currency) => {
        dispatch({ type: 'SET_CURRENCY', payload: currency });
    };

    const formatCurrency = (value: number, currency?: Currency) => {
        return formatCurrencyUtil(value, currency || selectedCurrency);
    };

    const getWalletBalance = (currency?: Currency) => {
        const targetCurrency = currency || selectedCurrency;
        return currentUser?.walletBalances?.[targetCurrency] ?? 0;
    }

    return {
        selectedCurrency,
        setSelectedCurrency,
        formatCurrency,
        getWalletBalance
    };
};

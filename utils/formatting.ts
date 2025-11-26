
import { Currency } from "../types";

export const formatCurrency = (value: number, currency: Currency): string => {
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
    };
    
    if (currency === 'PKR') {
        // PKR formatting is often without decimals for whole numbers
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = 2;
    } else {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2;
    }

    return new Intl.NumberFormat('en-US', options).format(value);
};

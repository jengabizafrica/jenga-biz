import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCY_MAP: Record<string, Currency> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£' },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
  TZS: { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  UGX: { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  RWF: { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw' },
};

/**
 * Hook to get allowed currencies from app settings
 */
export function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'allowed_currencies')
          .maybeSingle();

        if (!error && data) {
          const codes = data.value.split(',').map(c => c.trim()).filter(Boolean);
          const currencyList = codes
            .map(code => CURRENCY_MAP[code])
            .filter(Boolean);
          setCurrencies(currencyList);
          
          // Set default to first currency or USD
          const stored = localStorage.getItem('selected_currency');
          if (stored && codes.includes(stored)) {
            setSelectedCurrency(stored);
          } else if (currencyList.length > 0) {
            setSelectedCurrency(currencyList[0].code);
          }
        } else {
          // Default to USD
          setCurrencies([CURRENCY_MAP.USD]);
          setSelectedCurrency('USD');
        }
      } catch (err) {
        console.error('Failed to load currencies:', err);
        setCurrencies([CURRENCY_MAP.USD]);
        setSelectedCurrency('USD');
      } finally {
        setLoading(false);
      }
    };

    loadCurrencies();
  }, []);

  const changeCurrency = (code: string) => {
    setSelectedCurrency(code);
    localStorage.setItem('selected_currency', code);
  };

  const currentCurrency = CURRENCY_MAP[selectedCurrency] || CURRENCY_MAP.USD;

  return {
    currencies,
    selectedCurrency,
    currentCurrency,
    changeCurrency,
    loading,
  };
}

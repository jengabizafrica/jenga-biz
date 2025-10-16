import { useCurrencies } from '@/hooks/useCurrencies';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CurrencySelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

export function CurrencySelector({ 
  value, 
  onValueChange, 
  label = "Currency",
  disabled = false 
}: CurrencySelectorProps) {
  const { currencies, selectedCurrency, changeCurrency, loading } = useCurrencies();

  const handleChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      changeCurrency(newValue);
    }
  };

  const currentValue = value || selectedCurrency;

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <div className="h-10 w-full animate-pulse bg-muted rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select value={currentValue} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select currency" />
        </SelectTrigger>
        <SelectContent>
          {currencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              {currency.symbol} {currency.code} - {currency.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

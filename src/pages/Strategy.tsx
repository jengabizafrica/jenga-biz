import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CombinedStrategyFlow from '@/components/CombinedStrategyFlow';
import { useStrategy } from '@/hooks/useStrategy';

const Strategy = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loadStrategies, strategies, setCurrentStrategy } = useStrategy();
  
  const template = location.state?.template;
  const language = location.state?.language || 'en';
  const strategyId = searchParams.get('id');
  const defaultTab = searchParams.get('tab');

  console.log('STRATEGY.TSX DEBUG: Component mounted/updated');
  console.log('STRATEGY.TSX DEBUG: strategyId from URL:', strategyId);
  console.log('STRATEGY.TSX DEBUG: template from location.state:', template);
  console.log('STRATEGY.TSX DEBUG: strategies array length:', strategies.length);

  useEffect(() => {
    if (strategyId) {
      // Load strategies and find the specific strategy to edit
      const loadStrategy = async () => {
        console.log('STRATEGY.TSX DEBUG: Loading strategies for strategy ID:', strategyId);
        await loadStrategies();
      };
      loadStrategy();
    }
  }, [strategyId, loadStrategies]);

  // Separate effect to set current strategy when strategies are loaded
  useEffect(() => {
    console.log('STRATEGY.TSX DEBUG: Strategy setting effect triggered');
    console.log('STRATEGY.TSX DEBUG: strategyId:', strategyId);
    console.log('STRATEGY.TSX DEBUG: strategies.length:', strategies.length);
    console.log('STRATEGY.TSX DEBUG: strategies array:', strategies);
    
    if (strategyId && strategies.length > 0) {
      const strategyToEdit = strategies.find(s => s.id === strategyId);
      if (strategyToEdit) {
        console.log('STRATEGY.TSX DEBUG: Found strategy to edit:', strategyToEdit);
        console.log('STRATEGY.TSX DEBUG: Calling setCurrentStrategy with:', strategyToEdit);
        setCurrentStrategy(strategyToEdit);
      } else {
        console.error('STRATEGY.TSX DEBUG: Strategy not found with ID:', strategyId, 'Available strategies:', strategies);
      }
    } else if (!strategyId) {
      // Clear current strategy when no ID (new strategy)
      console.log('STRATEGY.TSX DEBUG: No strategyId, clearing currentStrategy');
      setCurrentStrategy(null);
    }
  }, [strategyId, strategies, setCurrentStrategy]);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleHome = () => {
    navigate('/');
  };

  const handleStrategyDeleted = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <CombinedStrategyFlow
      template={template}
      onBack={handleBack}
      onHome={handleHome}
      initialLanguage={language}
      currentStrategy={strategies.find(s => s.id === strategyId)}
      defaultTab={defaultTab}
      onStrategyDeleted={handleStrategyDeleted}
    />
  );
};

export default Strategy;

import { useEffect, useRef } from 'react';

// Custom hook for setting intervals
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay !== null) {
      const tick = () => {
        if (savedCallback.current) {
          savedCallback.current();
        }
      };
      
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
} 
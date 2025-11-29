// frontend/src/hooks/useApiQuery.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client.js';

const useApiQuery = ({ queryKey, url, enabled = true }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  const didInitRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;
    if (isFetchingRef.current) return;

    setIsFetching(true);
    isFetchingRef.current = true;
    setIsError(false);
    setError(null);

    try {
      const result = await apiClient.get(url);
      const responseData = result?.data ?? result;
      setData(responseData);
    } catch (err) {
      console.error('useApiQuery error:', err);
      setIsError(true);
      setError(err);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
      isFetchingRef.current = false;
    }
  }, [enabled, url]);

  useEffect(() => {
    if (didInitRef.current) {
      fetchData();
      return;
    }
    didInitRef.current = true;
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    setIsLoading(true);
    fetchData();
  };

  return { data, isLoading, isError, error, isFetching, refetch };
};

export { useApiQuery };
export default useApiQuery;

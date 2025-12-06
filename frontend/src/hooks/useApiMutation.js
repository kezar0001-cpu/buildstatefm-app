// frontend/src/hooks/useApiMutation.js
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';

export default function useApiMutation({ url, method = 'post', invalidateKeys = [], onSuccess }) {
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const invalidateProvidedKeys = async () => {
    if (!Array.isArray(invalidateKeys) || invalidateKeys.length === 0) {
      return;
    }

    const tasks = invalidateKeys
      .map((key) => {
        const resolvedKey = typeof key === 'function' ? key() : key;
        if (!resolvedKey) return null;

        if (Array.isArray(resolvedKey) || typeof resolvedKey === 'string') {
          return queryClient.invalidateQueries({ queryKey: resolvedKey });
        }

        if (resolvedKey?.queryKey) {
          return queryClient.invalidateQueries(resolvedKey);
        }

        return null;
      })
      .filter(Boolean);

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  };

  const mutateAsync = async (variables = {}) => {
    setIsPending(true);
    setIsError(false);
    setError(null);

    try {
      const resolvedMethod = variables.method || method || 'post';
      const resp = await apiClient.request({
        url: variables.url || url,
        method: resolvedMethod,
        data: variables.data,
        headers: variables.headers,
        params: variables.params,
        withCredentials: variables.withCredentials,
      });

      if (onSuccess) {
        await Promise.resolve(onSuccess(resp, variables));
      }
      await invalidateProvidedKeys();
      return resp;
    } catch (err) {
      // Enhanced error logging for debugging
      console.error('[useApiMutation] Error:', {
        url: variables.url || url,
        method: variables.method || method || 'post',
        error: err,
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        request: err?.request,
      });
      setIsError(true);
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  // Non-async mutate method for fire-and-forget scenarios
  const mutate = (variables = {}) => {
    mutateAsync(variables).catch((err) => {
      // Error is already logged in mutateAsync
      // This is a fire-and-forget call, so we don't need to do anything else
    });
  };

  return { mutate, mutateAsync, isPending, isError, error };
}

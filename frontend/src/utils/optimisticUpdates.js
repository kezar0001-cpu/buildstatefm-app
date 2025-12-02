/**
 * Optimistic update utilities for React Query mutations.
 * These helpers make it easy to implement instant UI feedback while
 * requests are in flight.
 */

/**
 * Create optimistic update handlers for list-based queries
 * 
 * @param {object} queryClient - React Query client
 * @param {array} queryKey - The query key to update optimistically
 * @returns {object} Mutation options object with onMutate, onError, onSettled
 * 
 * @example
 * const mutation = useMutation({
 *   mutationFn: updateJob,
 *   ...createOptimisticListUpdate(queryClient, ['jobs', 'list'], {
 *     updateFn: (oldData, variables) => {
 *       return oldData.map(item => 
 *         item.id === variables.id ? { ...item, ...variables } : item
 *       );
 *     }
 *   }),
 * });
 */
export function createOptimisticListUpdate(queryClient, queryKey, options = {}) {
  const { updateFn, getId = (item) => item?.id } = options;

  return {
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      if (previousData && updateFn) {
        queryClient.setQueryData(queryKey, (old) => updateFn(old, variables));
      }

      // Return context with the previous value
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Create optimistic update handlers for detail/single-item queries
 * 
 * @param {object} queryClient - React Query client
 * @param {function} getQueryKey - Function that returns query key given variables
 * @param {function} updateFn - Function to merge variables into existing data
 * @returns {object} Mutation options object
 * 
 * @example
 * const mutation = useMutation({
 *   mutationFn: updateJobStatus,
 *   ...createOptimisticDetailUpdate(
 *     queryClient,
 *     (variables) => ['jobs', variables.id],
 *     (oldData, variables) => ({ ...oldData, status: variables.status })
 *   ),
 * });
 */
export function createOptimisticDetailUpdate(queryClient, getQueryKey, updateFn) {
  return {
    onMutate: async (variables) => {
      const queryKey = getQueryKey(variables);
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      if (previousData && updateFn) {
        queryClient.setQueryData(queryKey, (old) => updateFn(old, variables));
      }

      return { previousData, queryKey };
    },
    onError: (err, variables, context) => {
      if (context?.previousData !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      const queryKey = getQueryKey(variables);
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Create optimistic handlers for adding an item to a list
 * 
 * @param {object} queryClient - React Query client
 * @param {array} queryKey - The query key to update
 * @param {function} createOptimisticItem - Function to create the optimistic item
 * @returns {object} Mutation options object
 */
export function createOptimisticAdd(queryClient, queryKey, createOptimisticItem) {
  return {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      // Create temporary ID for optimistic item
      const tempId = `temp-${Date.now()}`;
      const optimisticItem = createOptimisticItem
        ? createOptimisticItem(variables, tempId)
        : { ...variables, id: tempId, _optimistic: true };

      queryClient.setQueryData(queryKey, (old) => {
        if (Array.isArray(old)) {
          return [optimisticItem, ...old];
        }
        if (old?.items && Array.isArray(old.items)) {
          return { ...old, items: [optimisticItem, ...old.items] };
        }
        if (old?.data && Array.isArray(old.data)) {
          return { ...old, data: [optimisticItem, ...old.data] };
        }
        return old;
      });

      return { previousData, tempId };
    },
    onError: (err, variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Create optimistic handlers for removing an item from a list
 * 
 * @param {object} queryClient - React Query client
 * @param {array} queryKey - The query key to update
 * @param {function} getId - Function to get item ID from variables (default: v => v.id)
 * @returns {object} Mutation options object
 */
export function createOptimisticDelete(queryClient, queryKey, getId = (v) => v.id) {
  return {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);
      const idToRemove = getId(variables);

      queryClient.setQueryData(queryKey, (old) => {
        if (Array.isArray(old)) {
          return old.filter((item) => item.id !== idToRemove);
        }
        if (old?.items && Array.isArray(old.items)) {
          return { ...old, items: old.items.filter((item) => item.id !== idToRemove) };
        }
        if (old?.data && Array.isArray(old.data)) {
          return { ...old, data: old.data.filter((item) => item.id !== idToRemove) };
        }
        return old;
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Create optimistic toggle (e.g., for boolean properties like isRead, isActive)
 * 
 * @param {object} queryClient - React Query client
 * @param {array} queryKey - The query key to update
 * @param {string} property - The property to toggle
 * @param {function} getId - Function to get item ID from variables
 * @returns {object} Mutation options object
 */
export function createOptimisticToggle(queryClient, queryKey, property, getId = (v) => v.id) {
  return createOptimisticListUpdate(queryClient, queryKey, {
    updateFn: (old, variables) => {
      const idToToggle = getId(variables);
      
      if (Array.isArray(old)) {
        return old.map((item) =>
          item.id === idToToggle
            ? { ...item, [property]: !item[property] }
            : item
        );
      }
      return old;
    },
  });
}

export default {
  createOptimisticListUpdate,
  createOptimisticDetailUpdate,
  createOptimisticAdd,
  createOptimisticDelete,
  createOptimisticToggle,
};


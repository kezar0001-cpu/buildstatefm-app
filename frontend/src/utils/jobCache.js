export const snapshotJobQueries = (queryClient) =>
  queryClient.getQueriesData({ queryKey: ['jobs'] });

export const restoreJobQueries = (queryClient, snapshots) => {
  if (!snapshots) return;
  snapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
};

const mergeJobIntoData = (oldData, updatedJob) => {
  if (!oldData) return oldData;

  const mergeJob = (job) => (job?.id === updatedJob.id ? { ...job, ...updatedJob } : job);

  if (oldData.pages) {
    return {
      ...oldData,
      pages: oldData.pages.map((page) => ({
        ...page,
        items: Array.isArray(page.items) ? page.items.map(mergeJob) : page.items,
      })),
    };
  }

  if (Array.isArray(oldData)) {
    return oldData.map(mergeJob);
  }

  if (oldData.items) {
    return {
      ...oldData,
      items: oldData.items.map(mergeJob),
    };
  }

  if (oldData?.id === updatedJob.id) {
    return { ...oldData, ...updatedJob };
  }

  return oldData;
};

export const applyJobUpdateToQueries = (queryClient, updatedJob) => {
  if (!updatedJob?.id) return;
  queryClient.setQueriesData({ queryKey: ['jobs'] }, (oldData) => mergeJobIntoData(oldData, updatedJob));
};

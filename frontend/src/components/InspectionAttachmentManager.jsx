import AttachmentUploader from './AttachmentUploader';
import AttachmentList from './AttachmentList';

function isImageAttachment(attachment) {
  return attachment.mimeType?.startsWith('image/');
}

function isVideoAttachment(attachment) {
  return attachment.mimeType?.startsWith('video/');
}

const defaultAnnotation = (attachment) => {
  if (attachment?.annotations && typeof attachment.annotations === 'object') {
    return attachment.annotations;
  }
  return { note: '' };
};

const InspectionAttachmentManager = ({ inspectionId, attachments = [], canEdit = false }) => {
  const queryClient = useQueryClient();
  const [pendingFiles, setPendingFiles] = useState([]);
  const [annotationDrafts, setAnnotationDrafts] = useState(() => {
    const entries = attachments.map((attachment) => [attachment.id, defaultAnnotation(attachment).note || '']);
    return Object.fromEntries(entries);
  });

  useEffect(() => {
    setAnnotationDrafts((prev) => {
      const next = { ...prev };
      attachments.forEach((attachment) => {
        if (!(attachment.id in next)) {
          next[attachment.id] = defaultAnnotation(attachment).note || '';
        }
      });
      Object.keys(next).forEach((key) => {
        if (!attachments.find((attachment) => attachment.id === key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [attachments]);

  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const uploadResponse = await apiClient.post('/upload/multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const urls = uploadResponse.data?.urls || [];
      if (!urls.length) {
        throw new Error('Upload failed');
      }

      const payload = urls.map((url, index) => ({
        url,
        name: files[index].name,
        mimeType: files[index].type || 'application/octet-stream',
        size: files[index].size,
        annotations: { note: '' },
      }));

      await apiClient.post(`/inspections/${inspectionId}/attachments`, { attachments: payload });
    },
    onSuccess: () => {
      setPendingFiles([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    },
  });

  const updateAnnotationMutation = useMutation({
    mutationFn: async ({ attachmentId, note }) => {
      await apiClient.patch(`/inspections/${inspectionId}/attachments/${attachmentId}`, {
        annotations: { note },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId) => {
      await apiClient.delete(`/inspections/${inspectionId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.detail(inspectionId) });
    },
  });

  const handleFileChange = (event) => {
    if (!event.target.files) return;
    setPendingFiles(Array.from(event.target.files));
  };

  const handleUpload = () => {
    if (!pendingFiles.length) return;
    uploadMutation.mutate(pendingFiles);
  };

  const handleAnnotationChange = (attachmentId, value) => {
    setAnnotationDrafts((prev) => ({ ...prev, [attachmentId]: value }));
  };

  const handleAnnotationSave = (attachmentId) => {
    const note = annotationDrafts[attachmentId] ?? '';
    updateAnnotationMutation.mutate({ attachmentId, note });
  };

  const groupedAttachments = useMemo(() => {
    return attachments.reduce(
      (acc, attachment) => {
        if (isImageAttachment(attachment)) {
          acc.images.push(attachment);
        } else if (isVideoAttachment(attachment)) {
          acc.videos.push(attachment);
        } else {
          acc.documents.push(attachment);
        }
        return acc;
      },
      { images: [], videos: [], documents: [] },
    );
  }, [attachments]);

  return (
    <Box>
      {canEdit && (
        <AttachmentUploader
          pendingFiles={pendingFiles}
          onFileChange={handleFileChange}
          onUpload={handleUpload}
          isUploading={uploadMutation.isPending}
        />
      )}

      {!attachments.length ? (
        <Typography variant="body2" color="text.secondary">
          No attachments uploaded yet.
        </Typography>
      ) : (
        <AttachmentList
          attachments={groupedAttachments}
          canEdit={canEdit}
          annotationDrafts={annotationDrafts}
          onAnnotationChange={handleAnnotationChange}
          onAnnotationSave={handleAnnotationSave}
          onDelete={deleteMutation.mutate}
          isUpdating={updateAnnotationMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </Box>
  );
};

export default InspectionAttachmentManager;

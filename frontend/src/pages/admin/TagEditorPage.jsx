import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  getBlogTags,
  createBlogTag,
  updateBlogTag,
} from '../../api/blog';
import toast from 'react-hot-toast';
import logger from '../../utils/logger';

function TagEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = id && id !== 'new';

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  useEffect(() => {
    if (isEditMode) {
      fetchTag();
    }
  }, [id]);

  const fetchTag = async () => {
    try {
      const res = await getBlogTags();
      const tag = res.data.find((t) => t.id === id);
      if (tag) {
        setFormData({
          name: tag.name || '',
          slug: tag.slug || '',
        });
      }
    } catch (error) {
      logger.error('Error fetching tag:', error);
      toast.error('Failed to load tag');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-generate slug from name if creating new tag
    if (field === 'name' && !isEditMode) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditMode) {
        await updateBlogTag(id, formData);
        toast.success('Tag updated successfully');
      } else {
        await createBlogTag(formData);
        toast.success('Tag created successfully');
      }
      navigate('/admin/blog');
    } catch (error) {
      logger.error('Error saving tag:', error);
      toast.error(error.response?.data?.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/blog')}
          sx={{ textTransform: 'none' }}
        >
          Back to Blog Admin
        </Button>
        <Typography variant="h4" component="h1" fontWeight={700}>
          {isEditMode ? 'Edit Tag' : 'Create New Tag'}
        </Typography>
      </Box>

      <Paper sx={{ p: 4 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Slug"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            required
            helperText="URL-friendly version of the name"
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {saving ? 'Saving...' : isEditMode ? 'Update Tag' : 'Create Tag'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default TagEditorPage;

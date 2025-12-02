import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormControlLabel,
  Switch,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  getAdminBlogPost,
  createBlogPost,
  updateBlogPost,
  getBlogCategories,
  getBlogTags,
  createBlogCategory,
  createBlogTag,
} from '../../api/blog';
import RichTextEditor from '../../components/RichTextEditor';
import toast from 'react-hot-toast';
import logger from '../../utils/logger';

function BlogPostEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = id && id !== 'new';

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    htmlContent: '',
    coverImage: '',
    status: 'DRAFT',
    featured: false,
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [],
    ogImage: '',
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        getBlogCategories(),
        getBlogTags(),
      ]);
      setCategories(categoriesRes.data);
      setTags(tagsRes.data);

      if (isEditMode) {
        const postRes = await getAdminBlogPost(id);
        const post = postRes.data;
        setFormData({
          title: post.title || '',
          slug: post.slug || '',
          excerpt: post.excerpt || '',
          content: post.content || '',
          htmlContent: post.htmlContent || '',
          coverImage: post.coverImage || '',
          status: post.status || 'DRAFT',
          featured: post.featured || false,
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
          metaKeywords: post.metaKeywords || [],
          ogImage: post.ogImage || '',
        });

        // Set selected categories and tags
        const postCategories = post.categories?.map((pc) => pc.category) || [];
        const postTags = post.tags?.map((pt) => pt.tag) || [];
        setSelectedCategories(postCategories);
        setSelectedTags(postTags);
      }
    } catch (error) {
      logger.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-generate slug from title if creating new post
    if (field === 'title' && !isEditMode) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleCategoryChange = async (event, newValue) => {
    const processedCategories = [];

    for (const item of newValue) {
      if (typeof item === 'string') {
        // Split by comma and process each category
        const categoryNames = item.split(',').map(name => name.trim()).filter(name => name.length > 0);

        for (const categoryName of categoryNames) {
          // Check if category already exists
          const existingCategory = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

          if (existingCategory) {
            // Add existing category if not already selected
            if (!processedCategories.find(pc => pc.id === existingCategory.id)) {
              processedCategories.push(existingCategory);
            }
          } else {
            // Create new category
            try {
              const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              const response = await createBlogCategory({
                name: categoryName,
                slug: slug,
                description: '',
                color: '#3b82f6', // Default blue color
              });
              const newCategory = response.data;
              processedCategories.push(newCategory);
              setCategories((prev) => [...prev, newCategory]);
              toast.success(`Category "${categoryName}" created`);
            } catch (error) {
              logger.error('Error creating category:', error);
              toast.error(`Failed to create category "${categoryName}"`);
            }
          }
        }
      } else {
        // Existing category
        processedCategories.push(item);
      }
    }

    setSelectedCategories(processedCategories);
  };

  const handleTagChange = async (event, newValue) => {
    const processedTags = [];

    for (const item of newValue) {
      if (typeof item === 'string') {
        // Split by comma and process each tag
        const tagNames = item.split(',').map(name => name.trim()).filter(name => name.length > 0);

        for (const tagName of tagNames) {
          // Check if tag already exists
          const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());

          if (existingTag) {
            // Add existing tag if not already selected
            if (!processedTags.find(pt => pt.id === existingTag.id)) {
              processedTags.push(existingTag);
            }
          } else {
            // Create new tag
            try {
              const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              const response = await createBlogTag({
                name: tagName,
                slug: slug,
              });
              const newTag = response.data;
              processedTags.push(newTag);
              setTags((prev) => [...prev, newTag]);
              toast.success(`Tag "${tagName}" created`);
            } catch (error) {
              logger.error('Error creating tag:', error);
              toast.error(`Failed to create tag "${tagName}"`);
            }
          }
        }
      } else {
        // Existing tag
        processedTags.push(item);
      }
    }

    setSelectedTags(processedTags);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        categoryIds: selectedCategories.map((c) => c.id),
        tagIds: selectedTags.map((t) => t.id),
      };

      if (isEditMode) {
        await updateBlogPost(id, payload);
        toast.success('Post updated successfully');
      } else {
        await createBlogPost(payload);
        toast.success('Post created successfully');
      }
      navigate('/admin/blog');
    } catch (error) {
      logger.error('Error saving post:', error);
      toast.error(error.response?.data?.message || 'Failed to save post');
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/blog')}
          sx={{ textTransform: 'none' }}
        >
          Back to Posts
        </Button>
        <Typography variant="h4" component="h1" fontWeight={700}>
          {isEditMode ? 'Edit Post' : 'Create New Post'}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Main Content */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Content
              </Typography>

              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Slug"
                value={formData.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                required
                helperText="URL-friendly version of the title"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Excerpt"
                value={formData.excerpt}
                onChange={(e) => handleChange('excerpt', e.target.value)}
                multiline
                rows={2}
                helperText="Short summary for post listings"
                sx={{ mb: 3 }}
              />

              <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ mb: 1 }}>
                Content *
              </Typography>
              <RichTextEditor
                content={formData.htmlContent || formData.content}
                onChange={(html) => {
                  handleChange('htmlContent', html);
                  // Also update content field with plain text version (strip HTML for backwards compatibility)
                  const plainText = html.replace(/<[^>]*>/g, '');
                  handleChange('content', plainText);
                }}
                placeholder="Write your blog post content here..."
              />
            </Paper>

            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                SEO & Meta
              </Typography>

              <TextField
                fullWidth
                label="Meta Title"
                value={formData.metaTitle}
                onChange={(e) => handleChange('metaTitle', e.target.value)}
                helperText="SEO title (defaults to post title)"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Meta Description"
                value={formData.metaDescription}
                onChange={(e) => handleChange('metaDescription', e.target.value)}
                multiline
                rows={2}
                helperText="SEO description for search engines"
                sx={{ mb: 2 }}
              />

              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={formData.metaKeywords}
                onChange={(e, newValue) => handleChange('metaKeywords', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Meta Keywords"
                    helperText="Press Enter to add keywords"
                  />
                )}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="OG Image URL"
                value={formData.ogImage}
                onChange={(e) => handleChange('ogImage', e.target.value)}
                helperText="Open Graph image for social media sharing"
              />
            </Paper>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Publish Settings
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="PUBLISHED">Published</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.featured}
                    onChange={(e) => handleChange('featured', e.target.checked)}
                  />
                }
                label="Featured Post"
                sx={{ mb: 2 }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={saving}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {saving ? 'Saving...' : isEditMode ? 'Update Post' : 'Create Post'}
              </Button>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Featured Image
              </Typography>

              <TextField
                fullWidth
                label="Cover Image URL"
                value={formData.coverImage}
                onChange={(e) => handleChange('coverImage', e.target.value)}
                helperText="URL to the cover image"
              />

              {formData.coverImage && (
                <Box
                  component="img"
                  src={formData.coverImage}
                  alt="Cover preview"
                  sx={{
                    width: '100%',
                    height: 'auto',
                    mt: 2,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Categories
              </Typography>

              <Autocomplete
                multiple
                freeSolo
                options={categories}
                value={selectedCategories}
                onChange={handleCategoryChange}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select or Create Categories"
                    helperText="Type and press Enter to create new. Use commas to add multiple (e.g., 'Tech, Design, Development')"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.name}
                      size="small"
                      onDelete={getTagProps({ index }).onDelete}
                      sx={{
                        bgcolor: option.color || 'primary.main',
                        color: 'white',
                        '& .MuiChip-deleteIcon': {
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&:hover': {
                            color: 'white'
                          }
                        }
                      }}
                    />
                  ))
                }
              />
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Tags
              </Typography>

              <Autocomplete
                multiple
                freeSolo
                options={tags}
                value={selectedTags}
                onChange={handleTagChange}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select or Create Tags"
                    helperText="Type and press Enter to create new. Use commas to add multiple (e.g., 'react, javascript, web')"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.name}
                      size="small"
                      variant="outlined"
                      onDelete={getTagProps({ index }).onDelete}
                      sx={{
                        '& .MuiChip-deleteIcon': {
                          color: 'rgba(0, 0, 0, 0.5)',
                          '&:hover': {
                            color: 'rgba(0, 0, 0, 0.8)'
                          }
                        }
                      }}
                    />
                  ))
                }
              />
            </Paper>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
}

export default BlogPostEditorPage;

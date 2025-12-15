import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  TextField,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  getAdminBlogPosts,
  deleteBlogPost,
  getBlogCategories,
  getBlogTags,
} from '../../api/blog';
import toast from 'react-hot-toast';
import logger from '../../utils/logger';
import BlogAutomationTab from '../../components/BlogAutomationTab';
import FilterBar from '../../components/FilterBar/FilterBar';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} role="tabpanel">
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function BlogAdminPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [postsRes, categoriesRes, tagsRes] = await Promise.all([
        getAdminBlogPosts(),
        getBlogCategories(),
        getBlogTags(),
      ]);
      setPosts(postsRes.data.posts);
      setCategories(categoriesRes.data);
      setTags(tagsRes.data);
    } catch (error) {
      logger.error('Error fetching data:', error);
      toast.error('Failed to load blog data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (post) => {
    setPostToDelete(post);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteBlogPost(postToDelete.id);
      toast.success('Post deleted successfully');
      setDeleteDialogOpen(false);
      setPostToDelete(null);
      fetchData();
    } catch (error) {
      logger.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Blog Administration
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/blog/posts/new')}
          sx={{ textTransform: 'none' }}
        >
          Create New Post
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Posts" />
          <Tab label="Categories" />
          <Tab label="Tags" />
          <Tab label="Automation" />
        </Tabs>
      </Box>

      {/* Posts Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 3 }}>
          <FilterBar
            searchValue={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
            onSearchClear={() => setSearchQuery('')}
            searchPlaceholder="Search posts by title or excerpt..."
            filters={[]}
            filterValues={{}}
            onFilterChange={() => {}}
            onClearFilters={() => setSearchQuery('')}
            showViewToggle={false}
          />
        </Box>

        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Categories</TableCell>
                <TableCell>Views</TableCell>
                <TableCell>Published</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No posts found. Create your first blog post!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts.map((post) => (
                  <TableRow key={post.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{post.title}</Typography>
                      {post.featured && (
                        <Chip label="Featured" size="small" color="primary" sx={{ mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {post.author?.firstName} {post.author?.lastName}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={post.status}
                        size="small"
                        color={post.status === 'PUBLISHED' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {post.categories?.slice(0, 2).map((pc) => {
                        const category = pc?.category || pc?.BlogCategory;
                        if (!category) return null;
                        return (
                        <Chip
                          key={category.id}
                          label={category.name}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                        );
                      })}
                    </TableCell>
                    <TableCell>{post.viewCount || 0}</TableCell>
                    <TableCell>
                      {post.publishedAt
                        ? format(new Date(post.publishedAt), 'MMM d, yyyy')
                        : 'Not published'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                        title="View Post"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/blog/posts/${post.id}`)}
                        title="Edit Post"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(post)}
                        title="Delete Post"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Categories Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Categories</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/blog/categories/new')}
            sx={{ textTransform: 'none' }}
          >
            Add Category
          </Button>
        </Box>

        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Color</TableCell>
                <TableCell>Posts</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id} hover>
                  <TableCell>
                    <Chip
                      label={category.name}
                      sx={{
                        bgcolor: category.color || 'primary.main',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell>{category.slug}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        bgcolor: category.color || 'primary.main',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                  </TableCell>
                  <TableCell>{category.publishedPostsCount ?? category._count?.posts ?? 0}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/blog/categories/${category.id}`)}
                      title="Edit Category"
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tags Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Tags</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/blog/tags/new')}
            sx={{ textTransform: 'none' }}
          >
            Add Tag
          </Button>
        </Box>

        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Posts</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id} hover>
                  <TableCell>
                    <Chip label={tag.name} variant="outlined" />
                  </TableCell>
                  <TableCell>{tag.slug}</TableCell>
                  <TableCell>{tag.publishedPostsCount ?? tag._count?.posts ?? 0}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/blog/tags/${tag.id}`)}
                      title="Edit Tag"
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Automation Tab */}
      <TabPanel value={tabValue} index={3}>
        <BlogAutomationTab />
      </TabPanel>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Blog Post?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "<strong>{postToDelete?.title}</strong>"? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default BlogAdminPage;

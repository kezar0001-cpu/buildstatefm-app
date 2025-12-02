import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  TextField,
  InputAdornment,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Button
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import { format } from 'date-fns';
import { getBlogPosts, getBlogCategories, getBlogTags } from '../api/blog';
import SEO from '../components/SEO';
import BlogPublicNav from '../components/BlogPublicNav';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

const BlogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 9,
    total: 0,
    totalPages: 0
  });

  // Get filter params from URL
  const page = parseInt(searchParams.get('page') || '1');
  const categoryFilter = searchParams.get('category') || '';
  const tagFilter = searchParams.get('tag') || '';
  const searchFilter = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchFilter);

  useEffect(() => {
    fetchPosts();
    fetchCategories();
    fetchTags();
  }, [page, categoryFilter, tagFilter, searchFilter]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 9,
        ...(categoryFilter && { category: categoryFilter }),
        ...(tagFilter && { tag: tagFilter }),
        ...(searchFilter && { search: searchFilter })
      };

      const response = await getBlogPosts(params);
      setPosts(response.data.posts);
      setPagination(response.data.pagination);
    } catch (error) {
      logger.error('Error fetching blog posts:', error);
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await getBlogCategories();
      setCategories(response.data);
    } catch (error) {
      logger.error('Error fetching categories:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await getBlogTags();
      setTags(response.data);
    } catch (error) {
      logger.error('Error fetching tags:', error);
    }
  };

  const handlePageChange = (event, value) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', value.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = (e) => {
    const params = new URLSearchParams(searchParams);
    if (e.target.value) {
      params.set('category', e.target.value);
    } else {
      params.delete('category');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleTagChange = (tagSlug) => {
    const params = new URLSearchParams(searchParams);
    if (tagSlug) {
      params.set('tag', tagSlug);
    } else {
      params.delete('tag');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput) {
      params.set('search', searchInput);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasActiveFilters = categoryFilter || tagFilter || searchFilter;

  return (
    <>
      <SEO
        title="Blog"
        description="Read the latest insights, updates, and resources about property management from Buildstate FM"
        keywords={['property management', 'blog', 'real estate', 'maintenance', 'inspections']}
      />

      <BlogPublicNav />

      {/* Hero Section */}
      <Box
        sx={{
          background:
            'radial-gradient(circle at top left, rgba(249, 115, 22, 0.15), transparent 55%), radial-gradient(circle at top right, rgba(185, 28, 28, 0.12), transparent 50%), #ffffff',
          pt: { xs: 6, md: 8 },
          pb: 6
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{
            textAlign: 'center',
            maxWidth: 760,
            mx: 'auto'
          }}>
            {/* Eyebrow Label */}
            <Typography
              component="span"
              sx={{
                display: 'inline-block',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#0f172a',
                mb: 2
              }}
            >
              Buildstate FM Insights
            </Typography>

            {/* Main Heading */}
            <Typography variant="h1" component="h1" sx={{
              fontWeight: 800,
              fontSize: { xs: '2.5rem', sm: '3.2rem', md: '3.5rem' },
              color: '#0f172a',
              mb: 2,
              letterSpacing: '-0.04em',
              lineHeight: 1.1
            }}>
              Property Management Insights & Best Practices
            </Typography>

            {/* Subtitle */}
            <Typography variant="h5" sx={{
              maxWidth: 650,
              mx: 'auto',
              color: '#475569',
              fontWeight: 400,
              fontSize: { xs: '1.05rem', md: '1.1rem' },
              lineHeight: 1.7,
              opacity: 0.9
            }}>
              Expert advice, industry trends, and practical tips to help you manage properties more effectively
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#f8fafc',
          pt: 6,
          pb: 12
        }}
      >
        <Container maxWidth="lg">

          {/* Filters */}
          <Box sx={{
            mb: 6,
            p: 3,
            borderRadius: 3,
            bgcolor: 'white',
            boxShadow: '0 18px 35px rgba(15, 23, 42, 0.05)',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <form onSubmit={handleSearch}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search articles..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#86868b' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5,
                        '& fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&:hover fieldset': {
                          borderColor: '#b91c1c'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#b91c1c',
                          borderWidth: 2
                        }
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={handleCategoryChange}
                      sx={{
                        borderRadius: 1.5,
                        '& fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&:hover fieldset': {
                          borderColor: '#b91c1c'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#b91c1c',
                          borderWidth: 2
                        }
                      }}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.slug}>
                          {cat.name} ({cat._count?.posts || 0})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Tag</InputLabel>
                    <Select
                      value={tagFilter}
                      label="Tag"
                      onChange={(e) => handleTagChange(e.target.value)}
                      sx={{
                        borderRadius: 1.5,
                        '& fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&:hover fieldset': {
                          borderColor: '#b91c1c'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#b91c1c',
                          borderWidth: 2
                        }
                      }}
                    >
                      <MenuItem value="">All Tags</MenuItem>
                      {tags.map((tag) => (
                        <MenuItem key={tag.id} value={tag.slug}>
                          {tag.name} ({tag._count?.posts || 0})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    sx={{
                      background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                      color: '#ffffff',
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '0.95rem',
                      py: 1.2,
                      borderRadius: '999px',
                      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 16px 40px rgba(185, 28, 28, 0.15)'
                      }
                    }}
                  >
                    Search
                  </Button>
                </Grid>

                {hasActiveFilters && (
                  <Grid item xs={12} md={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="large"
                      onClick={clearFilters}
                      sx={{
                        color: '#b91c1c',
                        borderColor: 'rgba(248, 113, 113, 0.2)',
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: '0.95rem',
                        py: 1.2,
                        borderRadius: '999px',
                        bgcolor: 'rgba(255, 255, 255, 0.6)',
                        '&:hover': {
                          borderColor: '#b91c1c',
                          bgcolor: 'rgba(185, 28, 28, 0.04)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      Clear Filters
                    </Button>
                  </Grid>
                )}
              </Grid>
            </form>
          </Box>

          {/* Active Filters Display */}
          {(tagFilter || categoryFilter) && (
            <Box sx={{
              mb: 4,
              display: 'flex',
              gap: 1.5,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <Typography variant="body2" sx={{ color: '#86868b', fontWeight: 500 }}>
                Filtering by:
              </Typography>
              {tagFilter && (
                <Chip
                  label={tags.find(t => t.slug === tagFilter)?.name || tagFilter}
                  onDelete={() => handleTagChange('')}
                  sx={{
                    bgcolor: '#f5f5f7',
                    color: '#1d1d1f',
                    fontWeight: 500,
                    border: '1px solid #d2d2d7',
                    '& .MuiChip-deleteIcon': {
                      color: '#86868b',
                      '&:hover': {
                        color: '#b91c1c'
                      }
                    }
                  }}
                />
              )}
              {categoryFilter && (
                <Chip
                  label={categories.find(c => c.slug === categoryFilter)?.name || categoryFilter}
                  onDelete={handleCategoryChange}
                  sx={{
                    bgcolor: '#f5f5f7',
                    color: '#1d1d1f',
                    fontWeight: 500,
                    border: '1px solid #d2d2d7',
                    '& .MuiChip-deleteIcon': {
                      color: '#86868b',
                      '&:hover': {
                        color: '#b91c1c'
                      }
                    }
                  }}
                />
              )}
            </Box>
          )}

          {/* Loading State */}
          {loading ? (
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 12,
              minHeight: '400px',
              alignItems: 'center'
            }}>
              <CircularProgress size={50} sx={{ color: '#b91c1c' }} />
            </Box>
          ) : posts.length === 0 ? (
            /* Empty State */
            <Box sx={{
              textAlign: 'center',
              py: 12,
              px: 3
            }}>
              <Typography variant="h3" gutterBottom sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
                No posts found
              </Typography>
              <Typography variant="body1" sx={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.7 }}>
                Try adjusting your filters or check back later for new content
              </Typography>
            </Box>
          ) : (
            <>
              {/* Blog Posts Grid */}
              <Grid container spacing={{ xs: 3, md: 4 }}>
                {posts.map((post) => (
                  <Grid item xs={12} sm={6} md={4} key={post.id}>
                    <Card
                      component={Link}
                      to={`/blog/${post.slug}`}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        bgcolor: 'white',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        boxShadow: '0 18px 35px rgba(15, 23, 42, 0.05)',
                        textDecoration: 'none',
                        '&:hover': {
                          boxShadow: '0 25px 50px rgba(15, 23, 42, 0.15)',
                          transform: 'translateY(-6px)',
                          '& .blog-card-image': {
                            transform: 'scale(1.05)'
                          }
                        }
                      }}
                    >
                      {post.coverImage && (
                        <CardMedia
                          component="img"
                          image={post.coverImage}
                          alt={post.title}
                          className="blog-card-image"
                          sx={{
                            height: 240,
                            objectFit: 'cover',
                            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            bgcolor: '#f8fafc'
                          }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: { xs: 2.5, md: 3 } }}>
                        {/* Categories - Minimal */}
                        {post.categories && post.categories.length > 0 && (
                          <Box sx={{ mb: 1.5 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#b91c1c',
                                fontWeight: 600,
                                fontSize: '0.813rem',
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase'
                              }}
                            >
                              {post.categories[0].category.name}
                            </Typography>
                          </Box>
                        )}

                        {/* Title - Clean and prominent */}
                        <Typography
                          variant="h6"
                          sx={{
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '1.15rem',
                            lineHeight: 1.3,
                            mb: 1.5,
                            mt: 0.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {post.title}
                        </Typography>

                        {/* Excerpt */}
                        {post.excerpt && (
                          <Typography
                            variant="body2"
                            sx={{
                              mb: 3,
                              flexGrow: 1,
                              color: '#475569',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.6,
                              fontSize: '0.938rem'
                            }}
                          >
                            {post.excerpt}
                          </Typography>
                        )}

                        {/* Meta Info - Clean and minimal */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 'auto' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.813rem' }}>
                            {post.publishedAt && format(new Date(post.publishedAt), 'MMM d, yyyy')}
                          </Typography>
                          {post.tags && post.tags.length > 0 && (
                            <>
                              <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(148, 163, 184, 0.3)' }} />
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.813rem' }}>
                                {post.tags.length} {post.tags.length === 1 ? 'tag' : 'tags'}
                              </Typography>
                            </>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <Box sx={{
                  mt: 8,
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <Pagination
                    count={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    size="large"
                    showFirstButton
                    showLastButton
                    sx={{
                      '& .MuiPaginationItem-root': {
                        fontWeight: 500,
                        color: '#1d1d1f',
                        border: '1px solid #d2d2d7',
                        '&.Mui-selected': {
                          bgcolor: '#b91c1c',
                          color: 'white',
                          border: '1px solid #b91c1c',
                          '&:hover': {
                            bgcolor: '#991b1b',
                            border: '1px solid #991b1b'
                          }
                        },
                        '&:hover': {
                          bgcolor: '#f5f5f7',
                          border: '1px solid #86868b'
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </Container>
      </Box>
    </>
  );
};

export default BlogPage;

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Chip,
  Avatar,
  Divider,
  CircularProgress,
  Button,
  Card,
  CardContent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { format } from 'date-fns';
import { getBlogPost } from '../api/blog';
import logger from '../utils/logger';
import SEO from '../components/SEO';
import BlogPublicNav from '../components/BlogPublicNav';
import toast from 'react-hot-toast';

const BlogPostPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const response = await getBlogPost(slug);
      setPost(response.data);
    } catch (error) {
      logger.error('Error fetching blog post:', error);
      if (error.response?.status === 404) {
        toast.error('Blog post not found');
        navigate('/blog');
      } else {
        toast.error('Failed to load blog post');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!post) {
    return null;
  }

  const authorName = `${post.author?.firstName || ''} ${post.author?.lastName || ''}`.trim();

  return (
    <>
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        keywords={post.metaKeywords || []}
        image={post.ogImage || post.coverImage}
        url={`${window.location.origin}/blog/${post.slug}`}
        type="article"
        article={true}
        author={authorName}
        publishedDate={post.publishedAt}
        modifiedDate={post.updatedAt}
        tags={post.tags?.map(pt => pt.tag.name) || []}
      />

      <BlogPublicNav />

      <Box sx={{
        bgcolor: '#f8fafc',
        minHeight: '100vh',
        pb: 8
      }}>
        {/* Hero Section */}
        {post.coverImage && (
          <Box
            sx={{
              width: '100%',
              height: { xs: 320, sm: 380, md: 420 },
              position: 'relative',
              backgroundImage: `url(${post.coverImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '0 0 32px 32px',
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(185, 28, 28, 0.85) 0%, rgba(249, 115, 22, 0.7) 45%, rgba(15, 23, 42, 0.65) 100%)'
              }}
            />
          </Box>
        )}

        <Container
          maxWidth="md"
          sx={{
            mt: post.coverImage ? { xs: -14, sm: -16, md: -18 } : 8,
            pt: post.coverImage ? { xs: 6, md: 8 } : 0,
            position: 'relative',
            zIndex: 2
          }}
        >
          {/* Back Button */}
          <Button
            component={Link}
            to="/blog"
            startIcon={<ArrowBackIcon />}
            sx={{
              mb: 3,
              color: 'white',
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '0.95rem',
              px: 3,
              py: 1.25,
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              boxShadow: '0 6px 20px rgba(185, 28, 28, 0.3)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 30px rgba(185, 28, 28, 0.4)'
              }
            }}
          >
            Back to Blog
          </Button>

          {/* Article Card */}
          <Card sx={{
            p: { xs: 3, md: 6 },
            mb: 6,
            borderRadius: 3,
            boxShadow: '0 25px 50px rgba(15, 23, 42, 0.08)',
            bgcolor: 'white',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            {/* Categories */}
            {post.categories && post.categories.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#b91c1c',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase'
                  }}
                >
                  {post.categories[0].category.name}
                </Typography>
              </Box>
            )}

            {/* Title */}
            <Typography
              variant="h1"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                lineHeight: 1.1,
                color: '#0f172a',
                mb: 3,
                letterSpacing: '-0.04em'
              }}
            >
              {post.title}
            </Typography>

            {/* Meta Information */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 600 }}>
                {authorName}
              </Typography>
              <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(148, 163, 184, 0.3)' }} />
              {post.publishedAt && (
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  {format(new Date(post.publishedAt), 'MMMM d, yyyy')}
                </Typography>
              )}
              <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(148, 163, 184, 0.3)' }} />
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {post.viewCount || 0} views
              </Typography>
            </Box>

            <Divider sx={{ mb: 5, borderColor: 'rgba(148, 163, 184, 0.2)' }} />

            {/* Excerpt */}
            {post.excerpt && (
              <Typography
                variant="h6"
                sx={{
                  color: '#475569',
                  fontWeight: 400,
                  fontSize: '1.25rem',
                  lineHeight: 1.7,
                  mb: 5,
                  letterSpacing: '-0.01em',
                  opacity: 0.9
                }}
              >
                {post.excerpt}
              </Typography>
            )}

            {/* Content */}
            <Box
              sx={{
                '& h1, & h2, & h3, & h4, & h5, & h6': {
                  fontWeight: 700,
                  mt: 5,
                  mb: 2.5,
                  lineHeight: 1.3,
                  color: '#0f172a',
                  letterSpacing: '-0.02em'
                },
                '& h2': { fontSize: '2rem', mt: 6, fontWeight: 800 },
                '& h3': { fontSize: '1.5rem' },
                '& p': {
                  lineHeight: 1.7,
                  mb: 2.5,
                  fontSize: '1.05rem',
                  color: '#475569',
                  letterSpacing: '-0.005em'
                },
                '& a': {
                  color: '#b91c1c',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                },
                '& img': {
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 2,
                  my: 4,
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)'
                },
                '& ul, & ol': {
                  pl: 3,
                  mb: 3,
                  '& li': {
                    mb: 1.5,
                    lineHeight: 1.7,
                    fontSize: '1.05rem',
                    color: '#475569'
                  }
                },
                '& code': {
                  bgcolor: '#f8fafc',
                  color: '#0f172a',
                  p: 0.5,
                  px: 1,
                  borderRadius: 0.75,
                  fontFamily: 'monospace',
                  fontSize: '0.9em',
                  fontWeight: 500,
                  border: '1px solid rgba(148, 163, 184, 0.15)'
                },
                '& pre': {
                  bgcolor: '#0f172a',
                  color: '#f8fafc',
                  p: 3,
                  borderRadius: 2,
                  overflow: 'auto',
                  mb: 3,
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                  '& code': {
                    bgcolor: 'transparent',
                    p: 0,
                    color: 'inherit',
                    border: 'none'
                  }
                },
                '& blockquote': {
                  borderLeft: '4px solid #b91c1c',
                  pl: 3,
                  py: 0.5,
                  my: 4,
                  fontStyle: 'normal',
                  color: '#475569',
                  fontSize: '1.125rem',
                  bgcolor: 'rgba(249, 115, 22, 0.04)',
                  borderRadius: 1,
                  p: 3
                }
              }}
              dangerouslySetInnerHTML={{ __html: post.htmlContent || post.content }}
            />

            {/* Media Gallery */}
            {post.media && post.media.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                  Media
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  {post.media.map((media) => (
                    <Box key={media.id}>
                      {media.type === 'IMAGE' && (
                        <Box>
                          <img
                            src={media.url}
                            alt={media.altText || media.caption}
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: 8
                            }}
                          />
                          {media.caption && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                              {media.caption}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {media.type === 'VIDEO' && (
                        <Box>
                          <video
                            src={media.url}
                            controls
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: 8
                            }}
                          />
                          {media.caption && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                              {media.caption}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {media.type === 'EMBED' && (
                        <Box
                          dangerouslySetInnerHTML={{ __html: media.url }}
                          sx={{ borderRadius: 2, overflow: 'hidden' }}
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Divider sx={{ mt: 6, mb: 4, borderColor: 'rgba(148, 163, 184, 0.2)' }} />

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                  Tagged with
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {post.tags.map((pt) => (
                    <Chip
                      key={pt.tag.id}
                      label={pt.tag.name}
                      component={Link}
                      to={`/blog?tag=${pt.tag.slug}`}
                      clickable
                      size="medium"
                      sx={{
                        bgcolor: '#f8fafc',
                        color: '#0f172a',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        fontWeight: 600,
                        borderRadius: 2,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: 'rgba(185, 28, 28, 0.08)',
                          borderColor: '#b91c1c',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(185, 28, 28, 0.15)'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Card>

          {/* Call to Action */}
          <Card sx={{
            p: { xs: 4, md: 5 },
            textAlign: 'center',
            mb: 6,
            background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 25px 50px rgba(185, 28, 28, 0.2)',
            border: 'none'
          }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.75rem', md: '2rem' },
                mb: 2,
                letterSpacing: '-0.02em'
              }}
            >
              Ready to Transform Your Property Management?
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.95)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 500, mx: 'auto' }}>
              Join thousands of property managers who trust Buildstate FM
            </Typography>
            <Button
              component={Link}
              to="/signup"
              variant="contained"
              size="large"
              sx={{
                bgcolor: 'white',
                color: '#b91c1c',
                fontWeight: 700,
                textTransform: 'none',
                px: 4,
                py: 1.5,
                fontSize: '0.95rem',
                borderRadius: '999px',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
                '&:hover': {
                  bgcolor: '#f8fafc',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.2)'
                }
              }}
            >
              Get Started Free
            </Button>
          </Card>
        </Container>
      </Box>
    </>
  );
};

export default BlogPostPage;

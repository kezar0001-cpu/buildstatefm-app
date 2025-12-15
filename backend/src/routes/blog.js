import express from 'express';
import { z } from 'zod';
import prisma from '../config/prismaClient.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireAdmin, logAdminAction } from '../middleware/adminAuth.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import validate from '../middleware/validate.js';
import blogAutomationService from '../services/blogAutomationService.js';
import { processDailyBlogPost } from '../cron/blogAutomation.js';

const router = express.Router();

// Validation schemas
const blogPostCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().min(1, 'Content is required'),
  htmlContent: z.string().optional(),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  coverImage: z.string().url().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional().default('DRAFT'),
  featured: z.boolean().optional().default(false),
  metaTitle: z.string().max(60, 'Meta title must be less than 60 characters').optional(),
  metaDescription: z.string().max(160, 'Meta description must be less than 160 characters').optional(),
  metaKeywords: z.array(z.string()).optional().default([]),
  ogImage: z.string().url().optional().nullable(),
  categoryIds: z.array(z.string().min(1)).optional().default([]),
  tagIds: z.array(z.string().min(1)).optional().default([]),
  media: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['IMAGE', 'VIDEO']).optional().default('IMAGE'),
    caption: z.string().optional(),
    altText: z.string().optional(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
  })).optional().default([]),
});

const blogPostUpdateSchema = blogPostCreateSchema.partial();

/**
 * Helper function to generate URL-friendly slug
 */
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
};

/**
 * Helper function to ensure unique slug
 */
const ensureUniqueSlug = async (baseSlug, postId = null) => {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!existing || (postId && existing.id === postId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

/**
 * Determine if the current requester can view the blog post.
 * Draft/scheduled posts must remain private unless an admin is viewing them.
 *
 * @param {string} postStatus - The status of the blog post (e.g. PUBLISHED, DRAFT)
 * @param {string | undefined} userRole - The role of the current user, if any
 * @returns {boolean}
 */
export const canViewBlogPost = (postStatus, userRole) => {
  if (postStatus === 'PUBLISHED') {
    return true;
  }
  return userRole === 'ADMIN';
};

// ==================== PUBLIC ROUTES ====================

/**
 * GET /api/blog/posts
 * Get published blog posts (public)
 * Query params: page, limit, category, tag, search, featured
 */
router.get('/posts', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      search,
      featured
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() }
    };

    if (featured === 'true') {
      where.featured = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category) {
      where.BlogPostCategory = {
        some: {
          BlogCategory: {
            slug: category
          }
        }
      };
    }

    if (tag) {
      where.BlogPostTag = {
        some: {
          BlogTag: {
            slug: tag
          }
        }
      };
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take,
        orderBy: { publishedAt: 'desc' },
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          BlogPostCategory: {
            include: {
              BlogCategory: true
            }
          },
          BlogPostTag: {
            include: {
              BlogTag: true
            }
          },
          BlogMedia: {
            orderBy: { order: 'asc' }
          }
        }
      }),
      prisma.blogPost.count({ where })
    ]);

    const normalizedPosts = posts.map((post) => {
      return {
        ...post,
        author: post.User,
        categories: post.BlogPostCategory,
        tags: post.BlogPostTag,
        media: post.BlogMedia,
        User: undefined,
        BlogPostCategory: undefined,
        BlogPostTag: undefined,
        BlogMedia: undefined,
      };
    });

    res.json({
      posts: normalizedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return sendError(res, 500, 'Failed to fetch blog posts', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/blog/posts/:slug
 * Get single published blog post by slug (public)
 */
router.get('/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        BlogPostCategory: {
          include: {
            BlogCategory: true
          }
        },
        BlogPostTag: {
          include: {
            BlogTag: true
          }
        },
        BlogMedia: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!post) {
      return sendError(res, 404, 'Blog post not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Only allow viewing published posts (unless authenticated as admin)
    if (!canViewBlogPost(post.status, req.user?.role)) {
      return sendError(res, 404, 'Blog post not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Increment view count
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } }
    });

    res.json({
      ...post,
      author: post.User,
      categories: post.BlogPostCategory,
      tags: post.BlogPostTag,
      media: post.BlogMedia,
      User: undefined,
      BlogPostCategory: undefined,
      BlogPostTag: undefined,
      BlogMedia: undefined,
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return sendError(res, 500, 'Failed to fetch blog post', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/blog/categories
 * Get all blog categories (public)
 */
router.get('/categories', async (req, res) => {
  try {
    const [categories, categoryCounts] = await Promise.all([
      prisma.blogCategory.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.blogPostCategory.groupBy({
        by: ['categoryId'],
        where: {
          BlogPost: {
            status: 'PUBLISHED',
            publishedAt: { lte: new Date() },
          },
        },
        _count: { _all: true },
      }),
    ]);

    const countByCategoryId = new Map(categoryCounts.map((r) => [r.categoryId, r._count._all]));
    res.json(
      categories.map((c) => ({
        ...c,
        publishedPostsCount: countByCategoryId.get(c.id) || 0,
      }))
    );
  } catch (error) {
    console.error('Error fetching categories:', error);
    return sendError(res, 500, 'Failed to fetch categories', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/blog/tags
 * Get all blog tags (public)
 */
router.get('/tags', async (req, res) => {
  try {
    const [tags, tagCounts] = await Promise.all([
      prisma.blogTag.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.blogPostTag.groupBy({
        by: ['tagId'],
        where: {
          BlogPost: {
            status: 'PUBLISHED',
            publishedAt: { lte: new Date() },
          },
        },
        _count: { _all: true },
      }),
    ]);

    const countByTagId = new Map(tagCounts.map((r) => [r.tagId, r._count._all]));
    res.json(
      tags.map((t) => ({
        ...t,
        publishedPostsCount: countByTagId.get(t.id) || 0,
      }))
    );
  } catch (error) {
    console.error('Error fetching tags:', error);
    return sendError(res, 500, 'Failed to fetch tags', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/blog/admin/posts
 * Get all blog posts (admin only)
 */
router.get('/admin/posts', requireAdmin, logAdminAction('view_all_posts'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          BlogPostCategory: {
            include: {
              BlogCategory: true
            }
          },
          BlogPostTag: {
            include: {
              BlogTag: true
            }
          },
          _count: {
            select: {
              BlogMedia: true
            }
          }
        }
      }),
      prisma.blogPost.count({ where })
    ]);

    const normalizedPosts = posts.map((post) => {
      return {
        ...post,
        author: post.User,
        categories: post.BlogPostCategory,
        tags: post.BlogPostTag,
        _count: {
          ...(post._count || {}),
          media: post._count?.BlogMedia ?? 0,
        },
        User: undefined,
        BlogPostCategory: undefined,
        BlogPostTag: undefined,
      };
    });

    res.json({
      posts: normalizedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin blog posts:', error);
    return sendError(res, 500, 'Failed to fetch blog posts', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * GET /api/blog/admin/posts/:id
 * Get single blog post by ID (admin only)
 */
router.get('/admin/posts/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        BlogPostCategory: {
          include: {
            BlogCategory: true
          }
        },
        BlogPostTag: {
          include: {
            BlogTag: true
          }
        },
        BlogMedia: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!post) {
      return sendError(res, 404, 'Blog post not found', ErrorCodes.RES_NOT_FOUND);
    }

    res.json({
      ...post,
      author: post.User,
      categories: post.BlogPostCategory,
      tags: post.BlogPostTag,
      media: post.BlogMedia,
      User: undefined,
      BlogPostCategory: undefined,
      BlogPostTag: undefined,
      BlogMedia: undefined,
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return sendError(res, 500, 'Failed to fetch blog post', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * POST /api/blog/admin/posts
 * Create new blog post (admin only)
 */
router.post('/admin/posts', requireAuth, requireRole('ADMIN'), validate(blogPostCreateSchema), async (req, res) => {
  try {
    const {
      title,
      content,
      htmlContent,
      excerpt,
      coverImage,
      status = 'DRAFT',
      featured = false,
      metaTitle,
      metaDescription,
      metaKeywords = [],
      ogImage,
      categoryIds = [],
      tagIds = [],
      media = []
    } = req.body;

    // Generate slug
    const baseSlug = generateSlug(title);
    const slug = await ensureUniqueSlug(baseSlug);

    // Prepare post data
    const postData = {
      title,
      slug,
      content,
      htmlContent,
      excerpt,
      coverImage,
      status,
      featured,
      metaTitle: metaTitle || title,
      metaDescription,
      metaKeywords: Array.isArray(metaKeywords) ? metaKeywords : [],
      ogImage: ogImage || coverImage,
      authorId: req.user.id,
      publishedAt: status === 'PUBLISHED' ? new Date() : null
    };

    // Create post with relations
    const post = await prisma.blogPost.create({
      data: {
        id: uuidv4(),
        ...postData,
        updatedAt: new Date(),
        BlogPostCategory: {
          create: categoryIds.map(categoryId => ({
            id: uuidv4(),
            BlogCategory: { connect: { id: categoryId } }
          }))
        },
        BlogPostTag: {
          create: tagIds.map(tagId => ({
            id: uuidv4(),
            BlogTag: { connect: { id: tagId } }
          }))
        },
        BlogMedia: {
          create: media.map((item, index) => ({
            id: uuidv4(),
            url: item.url,
            type: item.type || 'IMAGE',
            caption: item.caption,
            altText: item.altText,
            mimeType: item.mimeType,
            size: item.size,
            order: index
          }))
        }
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        BlogPostCategory: {
          include: {
            BlogCategory: true
          }
        },
        BlogPostTag: {
          include: {
            BlogTag: true
          }
        },
        BlogMedia: true
      }
    });

    res.status(201).json({
      ...post,
      author: post.User,
      categories: post.BlogPostCategory,
      tags: post.BlogPostTag,
      media: post.BlogMedia,
      User: undefined,
      BlogPostCategory: undefined,
      BlogPostTag: undefined,
      BlogMedia: undefined,
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    return sendError(res, 500, 'Failed to create blog post', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * PUT /api/blog/admin/posts/:id
 * Update blog post (admin only)
 */
router.put('/admin/posts/:id', requireAuth, requireRole('ADMIN'), validate(blogPostUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      htmlContent,
      excerpt,
      coverImage,
      status,
      featured,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      categoryIds,
      tagIds,
      media
    } = req.body;

    // Check if post exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!existingPost) {
      return sendError(res, 404, 'Blog post not found', ErrorCodes.RES_NOT_FOUND);
    }

    // Prepare update data
    const updateData = {};

    if (title !== undefined) {
      updateData.title = title;
      // Only update slug if title changed
      if (title !== existingPost.title) {
        const baseSlug = generateSlug(title);
        updateData.slug = await ensureUniqueSlug(baseSlug, id);
      }
    }

    if (content !== undefined) updateData.content = content;
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (status !== undefined) {
      updateData.status = status;
      // Set publishedAt when changing to PUBLISHED
      if (status === 'PUBLISHED' && !existingPost.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }
    if (featured !== undefined) updateData.featured = featured;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (metaKeywords !== undefined) updateData.metaKeywords = metaKeywords;
    if (ogImage !== undefined) updateData.ogImage = ogImage;

    // Handle categories update
    if (categoryIds !== undefined) {
      updateData.BlogPostCategory = {
        deleteMany: {},
        create: categoryIds.map(categoryId => ({
          BlogCategory: { connect: { id: categoryId } }
        }))
      };
    }

    // Handle tags update
    if (tagIds !== undefined) {
      updateData.BlogPostTag = {
        deleteMany: {},
        create: tagIds.map(tagId => ({
          BlogTag: { connect: { id: tagId } }
        }))
      };
    }

    // Handle media update
    if (media !== undefined) {
      updateData.BlogMedia = {
        deleteMany: {},
        create: media.map((item, index) => ({
          url: item.url,
          type: item.type || 'IMAGE',
          caption: item.caption,
          altText: item.altText,
          mimeType: item.mimeType,
          size: item.size,
          order: index
        }))
      };
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: updateData,
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        BlogPostCategory: {
          include: {
            BlogCategory: true
          }
        },
        BlogPostTag: {
          include: {
            BlogTag: true
          }
        },
        BlogMedia: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json({
      ...post,
      author: post.User,
      categories: post.BlogPostCategory,
      tags: post.BlogPostTag,
      media: post.BlogMedia,
      User: undefined,
      BlogPostCategory: undefined,
      BlogPostTag: undefined,
      BlogMedia: undefined,
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    return sendError(res, 500, 'Failed to update blog post', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * DELETE /api/blog/admin/posts/:id
 * Delete blog post (admin only)
 */
router.delete('/admin/posts/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!post) {
      return sendError(res, 404, 'Blog post not found', ErrorCodes.RES_NOT_FOUND);
    }

    await prisma.blogPost.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Blog post deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return sendError(res, 500, 'Failed to delete blog post', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ==================== CATEGORY ADMIN ROUTES ====================

/**
 * POST /api/blog/admin/categories
 * Create new category (admin only)
 */
router.post('/admin/categories', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, color } = req.body;

    if (!name) {
      return sendError(res, 400, 'Category name is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const slug = generateSlug(name);

    const category = await prisma.blogCategory.create({
      data: {
        id: uuidv4(),
        name,
        slug: await ensureUniqueSlug(slug),
        description,
        color,
        updatedAt: new Date()
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return sendError(res, 400, 'Category name already exists', ErrorCodes.VAL_DUPLICATE);
    }
    return sendError(res, 500, 'Failed to create category', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * PUT /api/blog/admin/categories/:id
 * Update category (admin only)
 */
router.put('/admin/categories/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;

    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
      updateData.slug = await ensureUniqueSlug(generateSlug(name), id);
    }
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    const category = await prisma.blogCategory.update({
      where: { id },
      data: updateData
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Category not found', ErrorCodes.RES_NOT_FOUND);
    }
    return sendError(res, 500, 'Failed to update category', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * DELETE /api/blog/admin/categories/:id
 * Delete category (admin only)
 */
router.delete('/admin/categories/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.blogCategory.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Category not found', ErrorCodes.RES_NOT_FOUND);
    }
    return sendError(res, 500, 'Failed to delete category', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ==================== TAG ADMIN ROUTES ====================

/**
 * POST /api/blog/admin/tags
 * Create new tag (admin only)
 */
router.post('/admin/tags', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return sendError(res, 400, 'Tag name is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const slug = generateSlug(name);

    const tag = await prisma.blogTag.create({
      data: {
        id: uuidv4(),
        name,
        slug: await ensureUniqueSlug(slug),
        updatedAt: new Date()
      }
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    if (error.code === 'P2002') {
      return sendError(res, 400, 'Tag name already exists', ErrorCodes.VAL_DUPLICATE);
    }
    return sendError(res, 500, 'Failed to create tag', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * PUT /api/blog/admin/tags/:id
 * Update tag (admin only)
 */
router.put('/admin/tags/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return sendError(res, 400, 'Tag name is required', ErrorCodes.VAL_MISSING_FIELD);
    }

    const tag = await prisma.blogTag.update({
      where: { id },
      data: {
        name,
        slug: await ensureUniqueSlug(generateSlug(name), id)
      }
    });

    res.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Tag not found', ErrorCodes.RES_NOT_FOUND);
    }
    return sendError(res, 500, 'Failed to update tag', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * DELETE /api/blog/admin/tags/:id
 * Delete tag (admin only)
 */
router.delete('/admin/tags/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.blogTag.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Tag not found', ErrorCodes.RES_NOT_FOUND);
    }
    return sendError(res, 500, 'Failed to delete tag', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// ==================== BLOG AUTOMATION ADMIN ROUTES ====================

/**
 * GET /api/blog/admin/automation/status
 * Get automation statistics and status (admin only)
 */
router.get('/admin/automation/status', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const stats = await blogAutomationService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting automation status:', error);
    return sendError(res, 500, 'Failed to get automation status', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * POST /api/blog/admin/automation/generate
 * Manually trigger blog post generation (admin only)
 */
router.post('/admin/automation/generate', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    // Run the blog post generation asynchronously
    processDailyBlogPost().catch(error => {
      console.error('Background blog generation failed:', error);
    });

    res.json({
      success: true,
      message: 'Blog post generation started. Check status in a few moments.'
    });
  } catch (error) {
    console.error('Error triggering blog generation:', error);
    return sendError(res, 500, 'Failed to trigger blog generation', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

/**
 * PUT /api/blog/admin/automation/settings
 * Update automation settings (admin only)
 */
router.put('/admin/automation/settings', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return sendError(res, 400, 'Enabled must be a boolean', ErrorCodes.VAL_INVALID_FORMAT);
    }

    blogAutomationService.setEnabled(enabled);

    res.json({
      success: true,
      message: `Blog automation ${enabled ? 'enabled' : 'disabled'}`,
      enabled
    });
  } catch (error) {
    console.error('Error updating automation settings:', error);
    return sendError(res, 500, 'Failed to update settings', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;

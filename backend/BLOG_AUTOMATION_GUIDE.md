# Blog Automation Guide

## Overview

The Buildstate FM Blog Automation Bot is an AI-powered system that automatically generates and publishes high-quality blog posts on a daily basis. It uses Claude (Anthropic's AI) to create SEO-optimized, engaging content tailored to your industry, with automatic image generation and intelligent topic selection.

## Features

- **Automated Daily Posts**: Generate blog posts automatically on a schedule
- **AI-Powered Content**: Uses Claude AI for high-quality, engaging content
- **SEO Optimization**: Automatically includes meta titles, descriptions, and keywords
- **Smart Topic Selection**: Considers SEO value, viral potential, and usefulness
- **Image Generation**: Automatically generates or fetches relevant cover images
- **Category & Tag Management**: Automatically creates and assigns categories/tags
- **Manual Trigger**: Generate posts on-demand via admin API
- **Statistics Dashboard**: Track automation performance and metrics
- **Draft or Auto-Publish**: Choose whether to review posts before publishing

## Architecture

### Components

1. **Blog AI Service** (`src/services/blogAIService.js`)
   - Topic generation based on trends and SEO
   - Full blog post content generation
   - Image prompt generation
   - Content gap analysis

2. **Blog Image Service** (`src/services/blogImageService.js`)
   - Unsplash API integration for professional images
   - Automatic image download and upload to Cloudinary
   - Fallback to placeholder services
   - SEO-optimized alt text and metadata

3. **Blog Automation Service** (`src/services/blogAutomationService.js`)
   - Orchestrates the entire generation process
   - Manages categories and tags
   - Tracks automation metadata
   - Provides statistics

4. **Blog Automation Cron** (`src/cron/blogAutomation.js`)
   - Scheduled daily execution
   - Configurable schedule and timezone
   - Error handling and logging

## Setup Instructions

### 1. Install Dependencies

The required packages are already installed:
- `@anthropic-ai/sdk` - Claude AI API client
- `axios` - HTTP client for image fetching

### 2. Get API Keys

#### Anthropic Claude API (Required)
1. Sign up at https://console.anthropic.com
2. Create an API key
3. Add to your `.env` file:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```

#### Unsplash API (Optional, Recommended)
1. Sign up at https://unsplash.com/developers
2. Create a new application
3. Get your Access Key
4. Add to your `.env` file:
   ```
   UNSPLASH_ACCESS_KEY=your-access-key-here
   ```

**Note**: If you don't configure Unsplash, the system will use placeholder images.

### 3. Configure Environment Variables

Add these to your `.env` file:

```bash
# Enable the automation bot
BLOG_AUTOMATION_ENABLED=true

# Anthropic Claude API
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Unsplash API (optional)
UNSPLASH_ACCESS_KEY=your-unsplash-access-key

# Automation Settings
BLOG_INDUSTRY=facilities and property management
BLOG_TARGET_WORD_COUNT=1500
BLOG_AUTO_PUBLISH=false  # Set to true to auto-publish, false to save as draft

# Cron Schedule (default: 9 AM daily)
BLOG_CRON_SCHEDULE=0 9 * * *
CRON_TIMEZONE=UTC

# Optional: Disable cron job (manual trigger only)
DISABLE_BLOG_AUTOMATION_CRON=false

# Optional: Run on server startup
BLOG_AUTOMATION_RUN_ON_STARTUP=false
```

### 4. Run Database Migration

The database schema has been updated to track automated posts. Run the migration:

```bash
npx prisma migrate deploy
```

Or in development:

```bash
npx prisma migrate dev
```

### 5. Start the Server

The automation will start automatically when you run the server:

```bash
npm start
```

## Usage

### Automatic Generation

Once configured with `BLOG_AUTOMATION_ENABLED=true`, the bot will:
1. Run daily at the scheduled time (default: 9 AM)
2. Analyze recent posts to avoid repetition
3. Generate a new topic based on SEO, virality, and usefulness
4. Create full blog post content
5. Generate and attach a cover image
6. Create/assign categories and tags
7. Save as DRAFT or PUBLISHED (based on `BLOG_AUTO_PUBLISH`)

### Manual Generation

You can manually trigger post generation via the API:

```bash
POST /api/blog/admin/automation/generate
Authorization: Bearer <admin-jwt-token>
```

**Response**:
```json
{
  "success": true,
  "message": "Blog post generation started. Check status in a few moments."
}
```

### Check Statistics

Get automation statistics and recent posts:

```bash
GET /api/blog/admin/automation/status
Authorization: Bearer <admin-jwt-token>
```

**Response**:
```json
{
  "totalPosts": 50,
  "automatedPosts": 30,
  "publishedAutomated": 25,
  "draftAutomated": 5,
  "automationRate": "60.00",
  "recentAutomated": [
    {
      "id": "...",
      "title": "...",
      "status": "PUBLISHED",
      "publishedAt": "...",
      "viewCount": 123
    }
  ],
  "isEnabled": true,
  "autoPublish": false
}
```

### Enable/Disable Automation

Toggle automation on or off:

```bash
PUT /api/blog/admin/automation/settings
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json

{
  "enabled": true
}
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BLOG_AUTOMATION_ENABLED` | `false` | Enable/disable the automation bot |
| `ANTHROPIC_API_KEY` | - | **Required** Claude API key |
| `ANTHROPIC_MODEL` | `claude-3-5-haiku-20241022` | Claude model (auto-fallbacks: `claude-haiku-4-5-20251001`, `claude-sonnet-4-20250514`, `claude-sonnet-4-5-20250929`) |
| `UNSPLASH_ACCESS_KEY` | - | Optional Unsplash API key |
| `BLOG_INDUSTRY` | `facilities and property management` | Industry focus for content |
| `BLOG_TARGET_WORD_COUNT` | `1500` | Target word count for posts |
| `BLOG_AUTO_PUBLISH` | `false` | Auto-publish or save as draft |
| `BLOG_CRON_SCHEDULE` | `0 9 * * *` | Cron schedule (9 AM daily) |
| `DISABLE_BLOG_AUTOMATION_CRON` | `false` | Disable scheduled execution |
| `BLOG_AUTOMATION_RUN_ON_STARTUP` | `false` | Generate post on server start |
| `CRON_TIMEZONE` | `UTC` | Timezone for cron schedule |

### Cron Schedule Format

The `BLOG_CRON_SCHEDULE` uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, both 0 and 7 are Sunday)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Examples**:
- `0 9 * * *` - 9 AM daily (default)
- `0 6 * * 1` - 6 AM every Monday
- `0 12 * * 1,4` - 12 PM every Monday and Thursday
- `0 8 1 * *` - 8 AM on the 1st of every month

## Database Schema

### BlogPost Fields

The following fields track automation:

```prisma
model BlogPost {
  // ... other fields ...

  // Automation tracking
  isAutomated        Boolean  @default(false)
  automationMetadata Json?
}
```

### Automation Metadata Structure

```json
{
  "generatedAt": "2025-11-11T09:00:00.000Z",
  "topic": {
    "title": "...",
    "keywords": ["..."],
    "category": "...",
    "reasoning": "..."
  },
  "contentAnalysis": {
    "readingTime": "7 minutes",
    "keyTakeaways": ["...", "...", "..."]
  },
  "imagePrompt": "...",
  "imageMetadata": {
    "url": "...",
    "alt": "...",
    "source": "unsplash"
  },
  "aiModel": "claude-3-opus-20240229",
  "targetWordCount": 1500,
  "actualWordCount": 1543
}
```

## API Endpoints

### Public Endpoints

These work the same as manual posts:
- `GET /api/blog/posts` - List all published posts (including automated)
- `GET /api/blog/posts/:slug` - Get single post by slug

### Admin Endpoints

**Automation Management**:
- `GET /api/blog/admin/automation/status` - Get statistics
- `POST /api/blog/admin/automation/generate` - Trigger manual generation
- `PUT /api/blog/admin/automation/settings` - Enable/disable automation

**Standard Blog Management** (works for automated posts too):
- `GET /api/blog/admin/posts` - List all posts (filter by `isAutomated=true`)
- `PUT /api/blog/admin/posts/:id` - Edit automated post
- `DELETE /api/blog/admin/posts/:id` - Delete automated post

## Topic Generation Strategy

The AI considers multiple factors when generating topics:

1. **SEO Optimization**
   - Trending keywords in the industry
   - Search intent and volume
   - Long-tail keyword opportunities

2. **Viral Potential**
   - Shareability on social media
   - Engagement triggers
   - Current industry trends

3. **Usefulness**
   - Practical value to readers
   - Solves real pain points
   - Actionable advice

4. **Content Gaps**
   - Avoids recently covered topics
   - Fills gaps in existing content library
   - Addresses emerging trends

## Content Quality Features

### SEO Optimization
- Meta titles (60 characters max)
- Meta descriptions (155 characters max)
- Strategic keyword placement
- Semantic keyword variations
- Internal linking opportunities

### Content Structure
- Engaging introduction
- Clear H2/H3 headers
- Bullet points and lists
- Real-world examples
- Actionable takeaways
- Strong conclusion

### Images
- Professional, relevant images
- SEO-optimized alt text
- Proper attribution (Unsplash)
- Responsive formats

## Monitoring and Logs

### Application Logs

The automation logs important events:

```
INFO: Blog automation service initialized
INFO: Starting daily blog post generation
INFO: Generated blog topic: { topic }
INFO: Generated blog content: { title, wordCount }
INFO: Successfully generated daily blog post: { postId, title, status }
```

### Error Handling

Errors are logged with full context:

```
ERROR: Failed to generate blog topic: { error }
ERROR: Failed to generate daily blog post: { error, stack }
```

### Winston Logger

Logs are stored in:
- `logs/error.log` - Error level and above
- `logs/combined.log` - All logs
- Console - Development environment

## Troubleshooting

### Posts Not Generating

1. **Check if automation is enabled**:
   ```bash
   BLOG_AUTOMATION_ENABLED=true
   ```

2. **Verify API keys**:
   - Check `ANTHROPIC_API_KEY` is set correctly
   - Test the API key manually

3. **Check logs**:
   ```bash
   tail -f logs/combined.log
   ```

4. **Verify cron is running**:
   - Look for "Scheduling blog automation cron job" in logs
   - Check `DISABLE_BLOG_AUTOMATION_CRON` is not `true`

### Image Generation Failing

1. **Configure Unsplash** (recommended):
   - Add `UNSPLASH_ACCESS_KEY` to `.env`
   - Verify the key is valid

2. **Configure Cloudinary** (for image storage):
   - Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - Without Cloudinary, placeholder URLs will be used

3. **Check fallback**:
   - System will use placeholder images if Unsplash fails
   - Check logs for image service errors

### Content Quality Issues

1. **Model selection** (automatic fallback enabled):
   - Default: `claude-3-5-haiku-20241022` (fast, cost-effective)
   - Auto-fallback to: `claude-haiku-4-5-20251001` (Claude 4.5 Haiku)
   - Auto-fallback to: `claude-sonnet-4-20250514` (balanced quality/cost)
   - Auto-fallback to: `claude-sonnet-4-5-20250929` (highest quality)
   - The system automatically tries fallback models if primary model returns 404

2. **Customize industry**:
   ```bash
   BLOG_INDUSTRY=your specific industry or niche
   ```

3. **Adjust word count**:
   ```bash
   BLOG_TARGET_WORD_COUNT=2000  # For longer, more detailed posts
   ```

### Bot User Issues

The system automatically creates a bot user (`blog-bot@agentfm.com`) with ADMIN role. If you see errors about the author:

1. **Initialize the service**:
   - The bot user is created on first run
   - Check logs for "Created blog bot user"

2. **Verify bot user exists**:
   ```sql
   SELECT * FROM "User" WHERE email = 'blog-bot@agentfm.com';
   ```

## Best Practices

### 1. Review Before Publishing

Set `BLOG_AUTO_PUBLISH=false` initially:
- Review automated posts in draft
- Make any necessary edits
- Publish manually when satisfied

Once you trust the quality, enable auto-publish.

### 2. Monitor Performance

Regularly check:
- `/api/blog/admin/automation/status` for metrics
- View counts on automated posts
- User engagement and comments

### 3. Customize for Your Brand

Edit the services to:
- Add your brand voice guidelines
- Include custom CTAs
- Add industry-specific examples
- Customize image styles

### 4. Balance Automation and Manual Content

- Use automation for consistent publishing
- Write manual posts for major announcements
- Mix automated and manual content
- Maintain editorial oversight

### 5. SEO Monitoring

- Track rankings for automated posts
- Monitor keyword performance
- Adjust `BLOG_INDUSTRY` based on results
- Use automated posts to test new topics

## Cost Considerations

### Anthropic Claude API

Pricing (as of November 2024):
- **Claude 3.5 Sonnet**: ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens
- **Estimated cost per post**: $0.05 - $0.15
- **Monthly cost (daily posts)**: $1.50 - $4.50

### Unsplash API

- **Free tier**: Unlimited requests
- **Required**: Attribution (automatically handled)
- **Rate limits**: 50 requests/hour

### Cloudinary

- **Free tier**: 25 GB storage, 25 GB bandwidth/month
- **Should be sufficient** for blog images

**Total estimated monthly cost**: $1.50 - $5.00 for daily posts

## Future Enhancements

Potential improvements:

1. **Content Calendar**
   - Plan topics in advance
   - Schedule specific dates
   - Theme-based weeks/months

2. **A/B Testing**
   - Test different titles
   - Optimize for engagement
   - Learn from top performers

3. **Multi-language Support**
   - Generate posts in multiple languages
   - Target international audiences

4. **Integration with Social Media**
   - Auto-post to Twitter/LinkedIn
   - Generate social snippets
   - Schedule social promotions

5. **Analytics Integration**
   - Track SEO rankings
   - Monitor backlinks
   - Measure ROI

6. **Custom Templates**
   - Different post formats
   - Industry-specific structures
   - Seasonal content

## Support

For issues or questions:
1. Check logs in `logs/combined.log`
2. Review this documentation
3. Check environment variables
4. Contact your development team

## Security Notes

- Bot user cannot login (random password)
- Bot user has ADMIN role (needed to create posts)
- Bot user is marked as inactive (`isActive: false`)
- API endpoints require ADMIN role
- All automation is logged for audit

## License

This blog automation system is part of the Buildstate FM platform.

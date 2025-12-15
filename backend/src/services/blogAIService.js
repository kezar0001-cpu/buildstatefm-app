import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import logger from '../utils/logger.js';

class BlogAIService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.tavilyApiKey = process.env.TAVILY_API_KEY;

    // List of deprecated/unavailable Claude 3.x models that return 404 errors
    // These models are deprecated as of 2025 and being retired
    const deprecatedModels = [
      'claude-3-opus-20240229',      // Deprecated June 30, 2025, retiring January 5, 2026
      'claude-3-sonnet-20240229',    // Retired July 21, 2025
      'claude-3-haiku-20240307',     // Retired July 21, 2025
      'claude-3-5-sonnet-20241022',  // Being phased out
      'claude-3-5-sonnet-20240620'   // Being phased out
    ];

    // Priority list of working models (current as of November 2025)
    // Ordered by: cost-effectiveness, availability, and quality for blog content
    const workingModels = [
      'claude-3-5-haiku-20241022',   // Claude 3.5 Haiku - fastest, cheapest, widely available
      'claude-haiku-4-5-20251001',   // Claude 4.5 Haiku - available to all users
      'claude-sonnet-4-20250514',    // Claude 4 Sonnet - balanced, recommended by Anthropic
      'claude-sonnet-4-5-20250929'   // Claude 4.5 Sonnet - most powerful (more expensive)
    ];

    const envModel = process.env.ANTHROPIC_MODEL;

    // Check if environment variable has a deprecated/non-working model
    if (envModel && deprecatedModels.includes(envModel)) {
      logger.warn(`Environment variable ANTHROPIC_MODEL is set to "${envModel}" which is deprecated/unavailable.`);
      logger.warn(`Falling back to: ${workingModels[0]}`);
      logger.warn('Please update ANTHROPIC_MODEL environment variable to one of:');
      workingModels.forEach(m => logger.warn(`  - ${m}`));
      this.model = workingModels[0];
    } else if (envModel) {
      // Use environment variable if set and not deprecated
      this.model = envModel;
      logger.info(`Using environment variable ANTHROPIC_MODEL: ${this.model}`);
    } else {
      // Use default working model
      this.model = workingModels[0];
      logger.info(`No ANTHROPIC_MODEL set, using default: ${this.model}`);
    }

    // Store fallback models for retry logic
    this.fallbackModels = workingModels.filter(m => m !== this.model);

    logger.info(`Blog AI Service initialized with model: ${this.model}`);
    if (this.fallbackModels.length > 0) {
      logger.info(`Fallback models available: ${this.fallbackModels.join(', ')}`);
    }
  }

  /**
   * Make an API call with automatic retry on model 404 errors
   * @param {Function} apiCall - The API call function to execute
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise<any>} The API response
   */
  async _callWithRetry(apiCall, operationName) {
    const modelsToTry = [this.model, ...this.fallbackModels];

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];

      try {
        logger.info(`${operationName}: Attempting with model: ${model}`);
        const result = await apiCall(model);

        // Success! Update the current model if we had to use a fallback
        if (model !== this.model) {
          logger.info(`${operationName}: Success with fallback model ${model}. Updating default model.`);
          this.model = model;
          // Update fallback list
          this.fallbackModels = modelsToTry.filter(m => m !== model);
        }

        return result;
      } catch (error) {
        const is404 = error.status === 404 || error.message?.includes('404') || error.message?.includes('not_found_error');
        const isLastModel = i === modelsToTry.length - 1;

        if (is404 && !isLastModel) {
          logger.warn(`${operationName}: Model ${model} returned 404. Trying next fallback model...`);
          continue;
        }

        // Either not a 404, or we've exhausted all models
        if (is404 && isLastModel) {
          logger.error(`${operationName}: All models failed with 404. This API key may have limited model access.`);
          logger.error('Please check your Anthropic API key tier and available models at https://console.anthropic.com/');
        }

        throw error;
      }
    }
  }

  /**
   * Safely extract and parse JSON from AI response
   * Handles control characters and malformed JSON that AI models sometimes produce
   * @param {string} responseText - Raw response text from AI
   * @param {string} operationName - Name of operation for logging
   * @returns {Object} Parsed JSON object
   */
  _parseAIJsonResponse(responseText, operationName = 'parseJSON') {
    try {
      // Extract JSON from response (may have markdown code blocks or other text)
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        logger.error(`${operationName}: No JSON object found in response`);
        throw new Error('Failed to find JSON object in AI response');
      }

      let jsonString = jsonMatch[0];

      // Clean common control characters that break JSON parsing
      // Replace unescaped newlines, tabs, and other control chars in string values
      jsonString = jsonString
        .replace(/\\n/g, '\\n')  // Ensure \n is escaped
        .replace(/\\t/g, '\\t')  // Ensure \t is escaped
        .replace(/\\r/g, '\\r')  // Ensure \r is escaped
        // Fix unescaped control characters within JSON string values
        .replace(/("(?:[^"\\]|\\.)*")|[\x00-\x1F]/g, (match, stringMatch) => {
          // If it's a quoted string, keep it as is
          if (stringMatch) return stringMatch;
          // Otherwise, escape the control character
          return '\\u' + ('0000' + match.charCodeAt(0).toString(16)).slice(-4);
        });

      // Try to parse the cleaned JSON
      const parsed = JSON.parse(jsonString);
      return parsed;

    } catch (error) {
      // Provide detailed error logging
      logger.error(`${operationName}: JSON parsing failed`, {
        error: error.message,
        responsePreview: responseText.substring(0, 500) + '...'
      });

      // Try more aggressive cleaning for markdown content
      try {
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found');

        let jsonString = jsonMatch[0];

        // More aggressive cleaning: replace actual newlines/tabs in strings
        jsonString = jsonString.replace(
          /"([^"]*(?:\\.[^"]*)*)"/g,
          (match, content) => {
            // This is a quoted string - escape any literal control chars
            const cleaned = content
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
              .replace(/[\x00-\x1F]/g, (ch) => '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4));
            return `"${cleaned}"`;
          }
        );

        const parsed = JSON.parse(jsonString);
        logger.warn(`${operationName}: JSON parsed after aggressive cleaning`);
        return parsed;

      } catch (secondError) {
        logger.error(`${operationName}: Failed even after aggressive cleaning`, {
          originalError: error.message,
          secondError: secondError.message
        });
        throw new Error(`Failed to parse JSON from AI response: ${error.message}`);
      }
    }
  }

  /**
   * Generate a blog topic based on current trends and SEO considerations
   * @param {Object} options - Options for topic generation
   * @param {string[]} options.recentTopics - Recently used topics to avoid repetition
   * @param {string[]} options.categories - Available blog categories
   * @param {string} options.industry - Industry focus (e.g., 'facilities management', 'property management')
   * @returns {Promise<Object>} Topic details including title, keywords, and category
   */
  async generateTopic(options = {}) {
    const {
      recentTopics = [],
      categories = [],
      industry = 'facilities and property management'
    } = options;

    const prompt = `You are an expert content strategist specializing in ${industry}. Generate a compelling blog post topic that:

1. Is highly relevant to ${industry} professionals
2. Has strong SEO potential (trending keywords, search intent)
3. Has viral potential (shareable, engaging, addresses pain points)
4. Provides practical value to readers
5. Hasn't been covered recently (avoid these topics: ${recentTopics.join(', ') || 'none yet'})

${categories.length > 0 ? `Available categories: ${categories.join(', ')}` : ''}

Provide your response in JSON format:
{
  "title": "Compelling, SEO-optimized title (60-70 characters)",
  "slug": "url-friendly-slug",
  "category": "Most relevant category from the list",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "excerpt": "Brief 1-2 sentence description",
  "reasoning": "Why this topic is valuable for SEO, virality, and usefulness",
  "targetAudience": "Who will benefit most from this content",
  "searchIntent": "What problem or question this addresses"
}`;

    try {
      const message = await this._callWithRetry(
        async (model) => {
          return await this.client.messages.create({
            model: model,
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });
        },
        'generateTopic'
      );

      const responseText = message.content[0].text;
      const topic = this._parseAIJsonResponse(responseText, 'generateTopic');
      logger.info('Generated blog topic', { topic });

      return topic;
    } catch (error) {
      logger.error('Error generating blog topic', { error: error.message });
      throw error;
    }
  }

  /**
   * Simple markdown to HTML converter
   * Handles basic markdown formatting
   * @param {string} markdown - Markdown content
   * @returns {string} HTML content
   */
  _markdownToHtml(markdown) {
    let html = markdown;

    // Convert headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Convert bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Convert numbered lists
    html = html.replace(/^(\s*\d+\. .+(?:\n\s*\d+\. .+)*)/gm, (match) => {
      const items = match.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^\d+\.\s+/, ''))
        .map(content => `<li>${content}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    });

    // Convert bullet lists
    html = html.replace(/^(\s*[-\*] .+(?:\n\s*[-\*] .+)*)/gm, (match) => {
      const items = match.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^[-\*]\s+/, ''))
        .map(content => `<li>${content}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    });

    // Convert line breaks to paragraphs
    const paragraphs = html.split('\n\n');
    html = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') ||
          trimmed.startsWith('<ol') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      if (trimmed.startsWith('<details') || trimmed.startsWith('</details') || trimmed.startsWith('<summary')) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    }).filter(Boolean).join('\n');

    return html;
  }

  _isBulletHeavy(markdown) {
    const lines = String(markdown || '').split('\n');
    const listLineCount = lines.filter((line) => {
      const t = line.trim();
      if (!t) return false;
      return /^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t);
    }).length;

    const textLineCount = lines.filter((line) => line.trim()).length;
    if (textLineCount === 0) return false;
    const ratio = listLineCount / textLineCount;

    return listLineCount >= 18 || ratio >= 0.18;
  }

  _wrapSourcesInDetails(markdown) {
    const text = String(markdown || '');
    if (!/\n##\s+Sources\s*\n/i.test(text)) return text;
    if (/<details>\s*<summary>\s*Sources\s*<\/summary>/i.test(text)) return text;

    const re = /(\n##\s+Sources\s*\n)([\s\S]*?)(\n##\s+[^\n]+\n|$)/i;
    const match = text.match(re);
    if (!match) return text;

    const before = text.slice(0, match.index);
    const header = match[1];
    const body = (match[2] || '').trimEnd();
    const tailStart = (match.index || 0) + match[0].length - match[3].length;
    const after = text.slice(tailStart);

    const wrapped = `${header}<details><summary>Sources</summary>\n\n${body}\n\n</details>\n`;
    return `${before}${wrapped}${after}`;
  }

  /**
   * Generate full blog post content using multi-stage approach
   * Stage 1: Generate markdown content
   * Stage 2: Convert to HTML
   * Stage 3: Generate metadata
   * @param {Object} topic - Topic details from generateTopic
   * @param {number} targetWordCount - Target word count for the article
   * @returns {Promise<Object>} Blog post content with HTML
   */
  async generateContent(topic, targetWordCount = 1500) {
    try {
      // STAGE 1: Generate the article content in markdown
      logger.info('Stage 1: Generating article content in markdown...');

      const contentPrompt = `Write a comprehensive, high-quality blog post about "${topic.title}".

Target audience: ${topic.targetAudience}
Keywords to naturally include: ${topic.keywords.join(', ')}
Target word count: ${targetWordCount} words

IMPORTANT: Write the entire article in clean Markdown format. DO NOT wrap it in JSON or code blocks.

Structure your article as follows:
1. **Engaging Introduction** (2-3 paragraphs)
   - Hook the reader with a compelling opening
   - Present the problem or opportunity
   - Preview what they'll learn

2. **Main Content** (5-7 sections with ## headers)
   - Use clear section headers (##)
   - Include practical examples and specific details
   - Add bullet points or numbered lists where appropriate
   - Incorporate keywords naturally
   - Provide actionable insights

3. **Strong Conclusion** (2-3 paragraphs)
   - Summarize key points
   - Call to action
   - Leave reader with clear next steps

Write in a professional yet conversational tone. Make it engaging, practical, and valuable. START WRITING THE ARTICLE NOW:`;

      const contentMessage = await this._callWithRetry(
        async (model) => {
          return await this.client.messages.create({
            model: model,
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: contentPrompt
            }]
          });
        },
        'generateContent-markdown'
      );

      let markdownContent = contentMessage.content[0].text.trim();

      // Remove any markdown code block wrapping if present
      markdownContent = markdownContent.replace(/^```markdown?\n/i, '').replace(/\n```$/i, '');

      logger.info('Generated markdown content', {
        title: topic.title,
        contentLength: markdownContent.length,
        wordCount: markdownContent.split(/\s+/).length,
        preview: markdownContent.substring(0, 300) + '...'
      });

      // STAGE 2: Convert markdown to HTML
      logger.info('Stage 2: Converting markdown to HTML...');
      const htmlContent = this._markdownToHtml(markdownContent);

      logger.info('Converted to HTML', {
        htmlLength: htmlContent.length,
        preview: htmlContent.substring(0, 300) + '...'
      });

      // STAGE 3: Generate metadata in small JSON
      logger.info('Stage 3: Generating metadata...');

      const metadataPrompt = `For this blog post titled "${topic.title}", generate SEO metadata and additional information.

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "metaTitle": "SEO title 60 chars max",
  "metaDescription": "Meta description 155 chars max",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4"],
  "readingTime": "5",
  "keyTakeaways": ["takeaway1", "takeaway2", "takeaway3"]
}`;

      const metadataMessage = await this._callWithRetry(
        async (model) => {
          return await this.client.messages.create({
            model: model,
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: metadataPrompt
            }]
          });
        },
        'generateContent-metadata'
      );

      const metadataText = metadataMessage.content[0].text.trim();
      const metadata = this._parseAIJsonResponse(metadataText, 'generateContent-metadata');

      logger.info('Generated metadata', metadata);

      // Combine everything
      const result = {
        content: markdownContent,
        htmlContent: htmlContent,
        metaTitle: metadata.metaTitle || topic.title,
        metaDescription: metadata.metaDescription || topic.excerpt,
        suggestedTags: metadata.suggestedTags || [],
        readingTime: metadata.readingTime || '5',
        keyTakeaways: metadata.keyTakeaways || []
      };

      logger.info('✅ Successfully generated complete blog content', {
        title: topic.title,
        markdownLength: result.content.length,
        htmlLength: result.htmlContent.length,
        wordCount: result.content.split(/\s+/).length,
        hasAllFields: !!(result.content && result.htmlContent && result.metaTitle)
      });

      return result;

    } catch (error) {
      logger.error('Error generating blog content', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async generateResearch(topic, options = {}) {
    const {
      maxResults = 12,
      searchDepth = 'advanced',
    } = options;

    if (!this.tavilyApiKey) {
      logger.warn('TAVILY_API_KEY is not set; blog research will be skipped');
      return {
        provider: 'tavily',
        query: null,
        maxResults,
        searchDepth,
        sources: [],
        fetchedAt: new Date().toISOString(),
        skipped: true,
      };
    }

    const keywordQuery = Array.isArray(topic.keywords) && topic.keywords.length > 0
      ? topic.keywords.slice(0, 5).join(', ')
      : '';

    const query = [topic.title, keywordQuery].filter(Boolean).join(' — ');

    try {
      const response = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: this.tavilyApiKey,
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false,
        },
        {
          timeout: 30000,
        }
      );

      const results = Array.isArray(response.data?.results) ? response.data.results : [];

      const sources = results
        .map((r) => ({
          title: r?.title || '',
          url: r?.url || '',
          snippet: r?.content || r?.snippet || '',
        }))
        .filter((s) => s.url);

      logger.info('Fetched Tavily research results', {
        title: topic.title,
        query,
        sourcesCount: sources.length,
      });

      return {
        provider: 'tavily',
        query,
        maxResults,
        searchDepth,
        sources,
        fetchedAt: new Date().toISOString(),
        skipped: false,
      };
    } catch (error) {
      logger.error('Tavily research failed', {
        error: error.message,
        title: topic.title,
      });

      return {
        provider: 'tavily',
        query,
        maxResults,
        searchDepth,
        sources: [],
        fetchedAt: new Date().toISOString(),
        skipped: true,
        error: error.message,
      };
    }
  }

  async generateReportContent(topic, research, targetWordCount = 1800) {
    try {
      logger.info('Stage 1: Generating report-style article content in markdown...');

      const sources = Array.isArray(research?.sources) ? research.sources.slice(0, 15) : [];

      const sourcesText = sources.length > 0
        ? sources
            .map((s, idx) => {
              const title = (s.title || '').replace(/\s+/g, ' ').trim();
              const snippet = (s.snippet || '').replace(/\s+/g, ' ').trim();
              return `[${idx + 1}] ${title}\nURL: ${s.url}\nNotes: ${snippet}`;
            })
            .join('\n\n')
        : 'No sources available.';

      const contentPrompt = `You are a senior industry analyst and technical writer. Write a thoroughly researched, report-style article about "${topic.title}".

Target audience: ${topic.targetAudience}
Keywords to naturally include: ${topic.keywords.join(', ')}
Target word count: ${targetWordCount} words

Use ONLY the source list below for factual claims. If the sources do not support a claim, do NOT state it as fact.

When referencing information from a source, cite it inline using bracketed numbers like [1], [2]. Do not fabricate citations.

IMPORTANT: Write the entire article in clean Markdown format. DO NOT wrap it in JSON or code blocks.

Style rules (STRICT):
- Write primarily in paragraphs (prose). Avoid bullet lists.
- Do NOT use bullet points in Executive Summary, Context, Key Findings, Deep Dive, Recommendations, or Conclusion.
- The ONLY place a list is encouraged is "## Implementation Checklist" (numbered steps).
- If a list is absolutely necessary elsewhere, keep it to at most 3 items and justify it with one sentence before the list.

Required structure:
- # Title
- ## Executive Summary (2-4 short paragraphs)
- ## Context (why this matters now)
- ## Key Findings (3-7 findings as short subsections or paragraphs, each with citations)
- ## Deep Dive Analysis (multiple sections with ## headers)
- ## Practical Recommendations (grouped by role: Property Managers, Owners, Maintenance Teams; write as paragraphs)
- ## Implementation Checklist (numbered steps)
- ## Risks, Tradeoffs, and Compliance Notes
- ## Conclusion

Source list:
${sourcesText}

START WRITING THE ARTICLE NOW:`;

      const contentMessage = await this._callWithRetry(
        async (model) => {
          return await this.client.messages.create({
            model: model,
            max_tokens: 8192,
            messages: [{
              role: 'user',
              content: contentPrompt
            }]
          });
        },
        'generateReportContent-markdown'
      );

      let markdownContent = contentMessage.content[0].text.trim();
      markdownContent = markdownContent.replace(/^```markdown?\n/i, '').replace(/\n```$/i, '');

      if (this._isBulletHeavy(markdownContent)) {
        logger.warn('Report markdown is bullet-heavy; rewriting to prose-first format', {
          title: topic.title,
          model: this.model,
        });

        const rewritePrompt = `Rewrite the following Markdown article to be prose-first and minimize bullet/numbered lists.

Rules:
- Keep headings and overall structure.
- Preserve inline citations like [1], [2] and do NOT fabricate new citations.
- Convert bullet-heavy sections into paragraphs.
- Keep "## Implementation Checklist" as a numbered list.
- Keep "## Sources" as a numbered list.
- Do NOT add new facts beyond what is already present.

ARTICLE TO REWRITE (Markdown):
${markdownContent}`;

        const rewriteMessage = await this._callWithRetry(
          async (model) => {
            return await this.client.messages.create({
              model: model,
              max_tokens: 8192,
              messages: [{
                role: 'user',
                content: rewritePrompt
              }]
            });
          },
          'generateReportContent-rewrite'
        );

        const rewritten = rewriteMessage.content[0].text.trim();
        if (rewritten) {
          markdownContent = rewritten.replace(/^```markdown?\n/i, '').replace(/\n```$/i, '');
        }
      }

      if (sources.length > 0) {
        const sourcesSection = sources
          .map((s, idx) => {
            const title = (s.title || s.url).replace(/\s+/g, ' ').trim();
            return `${idx + 1}. ${title} — ${s.url}`;
          })
          .join('\n');

        if (!/\n##\s+Sources\s*\n/i.test(markdownContent)) {
          markdownContent = `${markdownContent}\n\n## Sources\n${sourcesSection}\n`;
        }
      }

      markdownContent = this._wrapSourcesInDetails(markdownContent);

      logger.info('Generated report markdown content', {
        title: topic.title,
        contentLength: markdownContent.length,
        wordCount: markdownContent.split(/\s+/).length,
        sourcesCount: sources.length,
        preview: markdownContent.substring(0, 300) + '...'
      });

      logger.info('Stage 2: Converting markdown to HTML...');
      const htmlContent = this._markdownToHtml(markdownContent);

      logger.info('Stage 3: Generating metadata...');
      const metadataPrompt = `For this blog post titled "${topic.title}", generate SEO metadata and additional information.

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "metaTitle": "SEO title 60 chars max",
  "metaDescription": "Meta description 155 chars max",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4"],
  "readingTime": "5",
  "keyTakeaways": ["takeaway1", "takeaway2", "takeaway3"]
}`;

      const metadataMessage = await this._callWithRetry(
        async (model) => {
          return await this.client.messages.create({
            model: model,
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: metadataPrompt
            }]
          });
        },
        'generateReportContent-metadata'
      );

      const metadataText = metadataMessage.content[0].text.trim();
      const metadata = this._parseAIJsonResponse(metadataText, 'generateReportContent-metadata');

      return {
        content: markdownContent,
        htmlContent: htmlContent,
        metaTitle: metadata.metaTitle || topic.title,
        metaDescription: metadata.metaDescription || topic.excerpt,
        suggestedTags: metadata.suggestedTags || [],
        readingTime: metadata.readingTime || '5',
        keyTakeaways: metadata.keyTakeaways || [],
        researchSummary: {
          provider: research?.provider || 'tavily',
          query: research?.query || null,
          sourcesCount: sources.length,
          skipped: !!research?.skipped,
        },
      };
    } catch (error) {
      logger.error('Error generating report-style blog content', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate an image prompt for the blog post
   * @param {Object} topic - Topic details
   * @param {string} content - Blog post content
   * @returns {Promise<string>} Image generation prompt
   */
  async generateImagePrompt(topic, content) {
    const prompt = `Based on this blog post topic and content, create a detailed image generation prompt for a professional cover image.

Topic: ${topic.title}
Keywords: ${topic.keywords.join(', ')}
Excerpt: ${topic.excerpt}

The image should:
1. Be professional and modern
2. Relate clearly to ${topic.category}
3. Be suitable for a business/professional blog
4. Avoid text or complex UI elements
5. Use colors that convey trust and professionalism

Provide a detailed, single-paragraph prompt for an AI image generator (like DALL-E or Stable Diffusion) that describes the visual style, composition, colors, and subject matter. Be specific but concise (100-150 words).`;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const imagePrompt = message.content[0].text.trim();
      logger.info('Generated image prompt', { imagePrompt });

      return imagePrompt;
    } catch (error) {
      logger.error('Error generating image prompt', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze existing blog posts to identify content gaps and opportunities
   * @param {Array} existingPosts - Array of existing blog post objects
   * @returns {Promise<Object>} Analysis with recommendations
   */
  async analyzeContentGaps(existingPosts = []) {
    const topicSummary = existingPosts
      .slice(0, 20) // Last 20 posts
      .map(post => `- ${post.title}`)
      .join('\n');

    const prompt = `Analyze these recent blog posts and identify content gaps and opportunities:

${topicSummary || 'No recent posts'}

Provide strategic recommendations for new content that:
1. Fills gaps in the current content library
2. Targets emerging trends in facilities/property management
3. Addresses reader questions and pain points
4. Has high SEO potential

Format as JSON:
{
  "gaps": ["gap1", "gap2", "gap3"],
  "opportunities": ["opportunity1", "opportunity2"],
  "trendingTopics": ["topic1", "topic2", "topic3"],
  "recommendations": "Overall content strategy recommendation"
}`;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse JSON response from AI');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error analyzing content gaps', { error: error.message });
      throw error;
    }
  }
}

export default new BlogAIService();

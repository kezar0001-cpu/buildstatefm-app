/**
 * Simple HTML sanitization utility for XSS prevention
 * Uses the browser's DOMParser to parse and sanitize HTML content
 * 
 * This is a defense-in-depth measure. Content should also be sanitized on the backend.
 */

// Tags that are allowed in the sanitized output
const ALLOWED_TAGS = new Set([
  // Structural
  'div', 'span', 'p', 'br', 'hr',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Text formatting
  'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'mark',
  // Lists
  'ul', 'ol', 'li',
  // Links
  'a',
  // Images
  'img',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  // Code
  'pre', 'code',
  // Quotes
  'blockquote', 'q', 'cite',
  // Media (for embedded content)
  'figure', 'figcaption',
  // Misc
  'article', 'section', 'aside', 'header', 'footer', 'main', 'nav',
]);

// Attributes that are allowed (by tag or globally)
const ALLOWED_ATTRIBUTES = {
  '*': ['class', 'id', 'style'],
  'a': ['href', 'target', 'rel', 'title'],
  'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan', 'scope'],
  'pre': ['data-language'],
  'code': ['data-language', 'class'],
};

// URL schemes that are safe
const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'data:']);

/**
 * Check if a URL is safe (not a javascript: or other dangerous scheme)
 */
function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url, 'https://example.com');
    return SAFE_URL_SCHEMES.has(parsed.protocol);
  } catch {
    // Relative URLs are safe
    return url.startsWith('/') || url.startsWith('#') || url.startsWith('./') || url.startsWith('../');
  }
}

/**
 * Sanitize a single element
 */
function sanitizeElement(element, doc) {
  const tagName = element.tagName.toLowerCase();
  
  // Remove script, style, and other dangerous elements
  if (!ALLOWED_TAGS.has(tagName)) {
    // Replace with its text content to preserve any readable text
    const textNode = doc.createTextNode(element.textContent || '');
    element.parentNode?.replaceChild(textNode, element);
    return;
  }
  
  // Get allowed attributes for this tag
  const globalAttrs = ALLOWED_ATTRIBUTES['*'] || [];
  const tagAttrs = ALLOWED_ATTRIBUTES[tagName] || [];
  const allowedAttrs = new Set([...globalAttrs, ...tagAttrs]);
  
  // Remove disallowed attributes
  const attrsToRemove = [];
  for (const attr of element.attributes) {
    const attrName = attr.name.toLowerCase();
    
    // Remove event handlers
    if (attrName.startsWith('on')) {
      attrsToRemove.push(attr.name);
      continue;
    }
    
    // Remove non-allowed attributes
    if (!allowedAttrs.has(attrName)) {
      attrsToRemove.push(attr.name);
      continue;
    }
    
    // Validate URLs in href and src attributes
    if (attrName === 'href' || attrName === 'src') {
      if (!isSafeUrl(attr.value)) {
        attrsToRemove.push(attr.name);
      }
    }
    
    // Sanitize style attribute (remove dangerous properties)
    if (attrName === 'style') {
      const sanitizedStyle = sanitizeStyle(attr.value);
      if (sanitizedStyle) {
        element.setAttribute('style', sanitizedStyle);
      } else {
        attrsToRemove.push(attr.name);
      }
    }
  }
  
  // Remove collected attributes
  for (const attr of attrsToRemove) {
    element.removeAttribute(attr);
  }
  
  // For links, add rel="noopener noreferrer" for security
  if (tagName === 'a' && element.hasAttribute('target')) {
    const existingRel = element.getAttribute('rel') || '';
    if (!existingRel.includes('noopener')) {
      element.setAttribute('rel', `${existingRel} noopener noreferrer`.trim());
    }
  }
  
  // Recursively sanitize children
  const children = Array.from(element.children);
  for (const child of children) {
    sanitizeElement(child, doc);
  }
}

/**
 * Sanitize inline styles (remove dangerous properties like expressions)
 */
function sanitizeStyle(styleString) {
  if (!styleString || typeof styleString !== 'string') return '';
  
  // Remove dangerous patterns
  const dangerous = /expression\s*\(|javascript:|behavior:|binding:/gi;
  if (dangerous.test(styleString)) {
    return '';
  }
  
  // Keep only safe CSS properties
  const safeProperties = new Set([
    'color', 'background', 'background-color', 'background-image',
    'font', 'font-size', 'font-weight', 'font-family', 'font-style',
    'text-align', 'text-decoration', 'text-transform',
    'line-height', 'letter-spacing', 'word-spacing',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-radius', 'border-color', 'border-width', 'border-style',
    'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'float', 'clear', 'overflow', 'vertical-align',
    'list-style', 'list-style-type',
    'opacity', 'visibility', 'z-index',
  ]);
  
  const result = [];
  const declarations = styleString.split(';');
  
  for (const decl of declarations) {
    const [prop, ...valueParts] = decl.split(':');
    if (!prop || valueParts.length === 0) continue;
    
    const propName = prop.trim().toLowerCase();
    const value = valueParts.join(':').trim();
    
    if (safeProperties.has(propName) && value) {
      result.push(`${propName}: ${value}`);
    }
  }
  
  return result.join('; ');
}

/**
 * Sanitize HTML string to prevent XSS attacks
 * @param {string} html - The HTML string to sanitize
 * @returns {string} - Sanitized HTML string
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  // If there's no HTML tags, return as-is
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html;
  }
  
  try {
    // Parse the HTML using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Get the body content
    const body = doc.body;
    
    // Sanitize all elements
    const elements = Array.from(body.children);
    for (const element of elements) {
      sanitizeElement(element, doc);
    }
    
    return body.innerHTML;
  } catch (error) {
    console.error('Error sanitizing HTML:', error);
    // Return escaped HTML as fallback
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export default sanitizeHtml;


import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

class InspectionAIService {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error('ANTHROPIC_API_KEY environment variable is not set');
      throw new Error('AI service configuration error: API key not configured');
    }
    
    this.client = new Anthropic({
      apiKey: apiKey,
    });

    // Use the same working models as blogAIService
    const workingModels = [
      'claude-3-5-haiku-20241022',   // Claude 3.5 Haiku - fastest, cheapest
      'claude-haiku-4-5-20251001',   // Claude 4.5 Haiku
      'claude-sonnet-4-20250514',    // Claude 4 Sonnet
      'claude-sonnet-4-5-20250929'   // Claude 4.5 Sonnet
    ];

    const envModel = process.env.ANTHROPIC_MODEL;
    this.model = (envModel && workingModels.includes(envModel)) ? envModel : workingModels[0];
    this.fallbackModels = workingModels.filter(m => m !== this.model);

    logger.info(`Inspection AI Service initialized with model: ${this.model}`);
  }

  /**
   * Make an API call with automatic retry on model 404 errors
   */
  async _callWithRetry(apiCall, operationName) {
    const modelsToTry = [this.model, ...this.fallbackModels];

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];

      try {
        logger.info(`${operationName}: Attempting with model: ${model}`);
        const result = await apiCall(model);

        if (model !== this.model) {
          logger.info(`${operationName}: Success with fallback model ${model}. Updating default model.`);
          this.model = model;
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

        if (is404 && isLastModel) {
          logger.error(`${operationName}: All models failed with 404. API key may have limited model access.`);
        }

        throw error;
      }
    }
  }

  /**
   * Parse AI JSON response safely with multiple fallback strategies
   */
  _parseAIJsonResponse(responseText, operationName = 'parseJSON') {
    const originalText = responseText;
    
    try {
      // Strategy 1: Try direct parsing first (in case it's already valid JSON)
      try {
        return JSON.parse(responseText);
      } catch (e) {
        // Not valid JSON, continue with extraction
      }

      // Strategy 2: Extract JSON from markdown code blocks
      let jsonString = responseText.trim();
      
      // Remove markdown code block markers if present
      jsonString = jsonString
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      
      // Strategy 3: Find JSON object using balanced braces
      let jsonMatch = null;
      
      // Try to find the outermost JSON object by counting braces
      let braceCount = 0;
      let startIndex = -1;
      for (let i = 0; i < jsonString.length; i++) {
        if (jsonString[i] === '{') {
          if (startIndex === -1) startIndex = i;
          braceCount++;
        } else if (jsonString[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            jsonMatch = jsonString.substring(startIndex, i + 1);
            break;
          }
        }
      }
      
      // Fallback to regex if brace counting didn't work
      if (!jsonMatch) {
        jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonMatch = jsonMatch[0];
        }
      }
      
      if (!jsonMatch) {
        logger.error(`${operationName}: No JSON object found in response`, { 
          responseText: originalText.substring(0, 1000),
          responseLength: originalText.length
        });
        throw new Error('Failed to find JSON object in AI response');
      }

      jsonString = jsonMatch;

      // Strategy 4: Clean and fix common JSON issues
      // Remove trailing commas before closing braces/brackets
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix control characters in string values (but preserve escaped ones)
      jsonString = jsonString.replace(/("(?:[^"\\]|\\.)*")|[\x00-\x1F]/g, (match, stringMatch) => {
        // If it's inside a quoted string, keep it as is
        if (stringMatch) return stringMatch;
        // Otherwise, escape the control character
        return '\\u' + ('0000' + match.charCodeAt(0).toString(16)).slice(-4);
      });

      // Strategy 5: Try parsing the cleaned JSON
      try {
        const parsed = JSON.parse(jsonString);
        return parsed;
      } catch (parseError) {
        // Strategy 6: Try to extract just the items array if the full object fails
        const itemsMatch = jsonString.match(/"items"\s*:\s*\[([\s\S]*)\]/);
        if (itemsMatch) {
          try {
            // Try to parse as a simple array
            const itemsArray = JSON.parse('[' + itemsMatch[1] + ']');
            return { items: itemsArray };
          } catch (e) {
            // Last resort: try to manually extract items
            const itemDescriptions = jsonString.match(/"description"\s*:\s*"([^"]+)"/g);
            if (itemDescriptions && itemDescriptions.length > 0) {
              const items = itemDescriptions.map(desc => {
                const match = desc.match(/"description"\s*:\s*"([^"]+)"/);
                return {
                  description: match ? match[1] : desc.replace(/"/g, ''),
                  priority: 'MEDIUM',
                  category: 'OTHER'
                };
              });
              logger.warn(`${operationName}: Using fallback extraction, parsed ${items.length} items`);
              return { items };
            }
          }
        }
        
        // If all strategies fail, log detailed error
        logger.error(`${operationName}: JSON parsing failed after all strategies`, {
          error: parseError.message,
          jsonString: jsonString.substring(0, 500),
          originalText: originalText.substring(0, 1000),
          position: parseError.message.match(/position (\d+)/)?.[1]
        });
        throw new Error(`Failed to parse JSON from AI response: ${parseError.message}`);
      }
    } catch (error) {
      logger.error(`${operationName}: JSON parsing failed`, { 
        error: error.message,
        responseText: originalText.substring(0, 1000),
        stack: error.stack
      });
      throw new Error(`Failed to parse JSON from AI response: ${error.message}`);
    }
  }

  /**
   * Generate inspection issues for a room based on type, notes, and inspection type
   * Reads the description/notes to identify specific issues that need repair
   * @param {Object} options
   * @param {string} options.roomType - Type of room (BEDROOM, BATHROOM, etc.)
   * @param {string} options.roomName - Name of the room
   * @param {string} options.notes - Additional notes/description about the room
   * @param {string} options.inspectionType - Type of inspection (ROUTINE, MOVE_IN, MOVE_OUT, etc.)
   * @returns {Promise<Array>} Array of issues with descriptions and priorities
   */
  async generateChecklist(options = {}) {
    const {
      roomType = 'OTHER',
      roomName = 'Room',
      notes = '',
      inspectionType = 'ROUTINE'
    } = options;

    // If notes/description is provided, extract issues from it
    // Otherwise, generate a standard checklist
    const hasDescription = notes && notes.trim().length > 0;

    let prompt;
    if (hasDescription) {
      prompt = `You are an expert property inspector. Analyze the following room description and identify ALL specific issues that require repair or attention.

Room: ${roomName} (${roomType})
Description: "${notes}"

Your task:
1. Read the description carefully
2. Identify EACH individual issue mentioned that needs repair (e.g., "water damage on ceiling" = one issue, "cracked tiles" = another issue, "electrical points not working" = another issue)
3. Create a SEPARATE issue item for EACH problem you identify
4. ONLY identify actual issues/problems that need fixing - do NOT create general inspection items
5. Each issue should be specific and actionable

Important:
- Each issue gets its own item (don't combine multiple issues into one)
- Be specific: "Water damage on ceiling in northeast corner" not just "Check ceiling"
- ONLY list actual problems/issues that need repair - skip anything that's in good condition
- If the description mentions something is working fine, do NOT include it
- Minimum 3 issues if problems are found, but create as many as needed to cover all issues mentioned

Inspection type context:
- ROUTINE: Maintenance issues, wear and tear, things needing repair
- MOVE_IN: Document existing damage and issues
- MOVE_OUT: Document damages and issues that need repair
- EMERGENCY: Safety hazards, urgent repairs needed
- COMPLIANCE: Code violations, safety issues

CRITICAL: You MUST respond with ONLY valid JSON. Do NOT include markdown code blocks, explanations, or any other text. Start your response with { and end with }. Example format:

{"items":[{"description":"Water damage on ceiling in northeast corner requires repair","priority":"HIGH","category":"STRUCTURAL"},{"description":"11 loose floor tiles need retiling","priority":"MEDIUM","category":"STRUCTURAL"},{"description":"Electrical outlets not functioning properly - needs electrician","priority":"HIGH","category":"ELECTRICAL"}]}`;
    } else {
      prompt = `You are an expert property inspector. For a ${roomName} (${roomType}) during a ${inspectionType} inspection, identify common issues that typically need repair or attention in this type of room.

Requirements:
1. Create 5-10 specific issues that commonly need repair in this room type
2. Each item should be an actual problem/issue that requires fixing
3. Focus on observable issues: damage, malfunctions, safety hazards, wear and tear
4. For each issue, create a SEPARATE item (don't combine multiple issues)
5. Include detailed descriptions for clarity
6. Prioritize items based on safety, functionality, and aesthetics

Important:
- ONLY list actual issues/problems - do NOT create general "check" items
- Focus on things that typically need repair in this room type
- Each issue should be something that requires action/repair

Inspection type considerations:
- ROUTINE: Maintenance issues, wear and tear, things needing repair
- MOVE_IN: Common existing damage and issues to document
- MOVE_OUT: Typical damages and issues that need repair
- EMERGENCY: Safety hazards, urgent repairs needed
- COMPLIANCE: Code violations, safety issues

CRITICAL: You MUST respond with ONLY valid JSON. Do NOT include markdown code blocks, explanations, or any other text. Start your response with { and end with }. Example format:

{"items":[{"description":"Cracks in walls requiring patching and repainting","priority":"MEDIUM","category":"STRUCTURAL"},{"description":"Non-functional electrical outlets need repair","priority":"HIGH","category":"ELECTRICAL"}]}`;
    }

    try {
      let message;
      try {
        message = await this._callWithRetry(
          async (model) => {
            return await this.client.messages.create({
              model: model,
              max_tokens: 2048,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          },
          'generateChecklist'
        );
      } catch (apiError) {
        logger.error('AI API call failed', {
          error: apiError.message,
          errorStatus: apiError.status,
          errorCode: apiError.code,
          roomType,
          inspectionType
        });
        throw new Error(`AI service unavailable: ${apiError.message || 'Unknown error'}`);
      }

      // Validate message structure
      if (!message || !message.content) {
        logger.error('Invalid AI response structure - no content', { message });
        throw new Error('AI service returned invalid response structure');
      }

      // Handle different content formats
      let responseText;
      if (Array.isArray(message.content)) {
        if (message.content.length === 0) {
          logger.error('Invalid AI response structure - empty content array', { message });
          throw new Error('AI service returned empty response');
        }
        // Get text from first content block
        const firstContent = message.content[0];
        if (firstContent.type === 'text' && firstContent.text) {
          responseText = firstContent.text;
        } else if (typeof firstContent === 'string') {
          responseText = firstContent;
        } else if (firstContent.text) {
          responseText = firstContent.text;
        } else {
          logger.error('Invalid AI response structure - cannot extract text', { 
            message, 
            firstContent,
            contentTypes: message.content.map(c => typeof c === 'object' ? c.type : typeof c)
          });
          throw new Error('AI service returned response in unexpected format');
        }
      } else if (typeof message.content === 'string') {
        responseText = message.content;
      } else if (message.content.text) {
        responseText = message.content.text;
      } else {
        logger.error('Invalid AI response structure - unknown format', { message });
        throw new Error('AI service returned response in unknown format');
      }
      
      if (!responseText || typeof responseText !== 'string') {
        logger.error('AI response is not a string', { 
          responseType: typeof responseText,
          response: responseText 
        });
        throw new Error('AI service returned non-string response');
      }
      
      // Log the raw response for debugging (first 500 chars)
      logger.debug('AI response received', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500),
        startsWithBrace: responseText.trim().startsWith('{'),
        hasMarkdown: responseText.includes('```')
      });

      let result;
      try {
        result = this._parseAIJsonResponse(responseText, 'generateChecklist');
      } catch (parseError) {
        logger.error('JSON parsing failed', {
          parseError: parseError.message,
          responsePreview: responseText.substring(0, 1000),
          roomType,
          inspectionType
        });
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Validate result structure
      if (!result || typeof result !== 'object') {
        logger.error('Parsed result is not an object', { result });
        throw new Error('AI service returned invalid data format');
      }

      const items = result.items || result.issues || [];
      
      if (!Array.isArray(items)) {
        logger.error('Items is not an array', { items, result });
        throw new Error('AI service did not return a valid items array');
      }

      // Filter out invalid items
      const validItems = items.filter(item => {
        if (!item || typeof item !== 'object') return false;
        if (!item.description || typeof item.description !== 'string' || item.description.trim().length === 0) {
          return false;
        }
        return true;
      });

      if (validItems.length === 0) {
        logger.warn('No valid items found after filtering', { items, result });
        throw new Error('AI service did not return any valid checklist items');
      }

      logger.info('Generated checklist', {
        roomType,
        roomName,
        inspectionType,
        hasDescription,
        itemCount: validItems.length,
        totalItems: items.length
      });

      return validItems;
    } catch (error) {
      logger.error('Error generating checklist', {
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
        roomType,
        inspectionType,
        hasDescription
      });
      throw error;
    }
  }

  /**
   * Analyze inspection notes and extract individual issues
   * @param {string} notes - Raw notes from inspector
   * @returns {Promise<Array>} Array of structured issues
   */
  async extractIssues(notes) {
    if (!notes || notes.trim().length === 0) {
      return [];
    }

    const prompt = `Analyze these inspection notes and extract individual issues. Each issue should be a separate, actionable item.

Notes: "${notes}"

Extract specific issues and respond with JSON:
{
  "issues": [
    {
      "title": "Brief title (5-8 words)",
      "description": "Detailed description (1-2 sentences)",
      "severity": "LOW | MEDIUM | HIGH | CRITICAL",
      "category": "SAFETY | STRUCTURAL | PLUMBING | ELECTRICAL | COSMETIC | CLEANING | OTHER"
    }
  ]
}

If no issues are found in the notes, return an empty array.`;

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
        'extractIssues'
      );

      const responseText = message.content[0].text;
      const result = this._parseAIJsonResponse(responseText, 'extractIssues');

      logger.info('Extracted issues from notes', {
        notesLength: notes.length,
        issueCount: result.issues?.length || 0
      });

      return result.issues || [];
    } catch (error) {
      logger.error('Error extracting issues', { error: error.message });
      throw error;
    }
  }
}

export default new InspectionAIService();

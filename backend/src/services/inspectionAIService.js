import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

class InspectionAIService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
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
   * Parse AI JSON response safely
   */
  _parseAIJsonResponse(responseText, operationName = 'parseJSON') {
    try {
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error(`${operationName}: No JSON object found in response`);
        throw new Error('Failed to find JSON object in AI response');
      }

      let jsonString = jsonMatch[0];

      // Clean control characters
      jsonString = jsonString
        .replace(/\\n/g, '\\n')
        .replace(/\\t/g, '\\t')
        .replace(/\\r/g, '\\r')
        .replace(/("(?:[^"\\]|\\.)*")|[\x00-\x1F]/g, (match, stringMatch) => {
          if (stringMatch) return stringMatch;
          return '\\u' + ('0000' + match.charCodeAt(0).toString(16)).slice(-4);
        });

      return JSON.parse(jsonString);
    } catch (error) {
      logger.error(`${operationName}: JSON parsing failed`, { error: error.message });
      throw new Error(`Failed to parse JSON from AI response: ${error.message}`);
    }
  }

  /**
   * Generate inspection checklist for a room based on type, notes, and inspection type
   * @param {Object} options
   * @param {string} options.roomType - Type of room (BEDROOM, BATHROOM, etc.)
   * @param {string} options.roomName - Name of the room
   * @param {string} options.notes - Additional notes about the room
   * @param {string} options.inspectionType - Type of inspection (ROUTINE, MOVE_IN, MOVE_OUT, etc.)
   * @returns {Promise<Array>} Array of checklist items with descriptions and priorities
   */
  async generateChecklist(options = {}) {
    const {
      roomType = 'OTHER',
      roomName = 'Room',
      notes = '',
      inspectionType = 'ROUTINE'
    } = options;

    const prompt = `You are an expert property inspector. Generate a comprehensive inspection checklist for a ${roomName} (${roomType}) during a ${inspectionType} inspection.

${notes ? `Additional context: ${notes}` : ''}

Requirements:
1. Create 5-10 specific, actionable checklist items
2. Each item should be a clear inspection point that can be marked as PASSED, FAILED, or N/A
3. Focus on practical, observable issues
4. For each issue, create a SEPARATE checklist item (don't combine multiple issues)
5. Include detailed descriptions for clarity
6. Prioritize items based on safety, functionality, and aesthetics

Inspection type considerations:
- ROUTINE: General condition, wear and tear, maintenance needs
- MOVE_IN: Document existing condition, verify cleanliness and functionality
- MOVE_OUT: Compare to move-in condition, document damages, verify cleaning
- EMERGENCY: Safety hazards, urgent repairs needed
- COMPLIANCE: Building codes, safety regulations

Respond with a JSON object containing an array of checklist items:
{
  "items": [
    {
      "description": "Clear, specific inspection point (e.g., 'Check walls for cracks, holes, or water damage')",
      "priority": "HIGH | MEDIUM | LOW",
      "category": "SAFETY | FUNCTIONALITY | AESTHETICS | CLEANLINESS"
    }
  ]
}`;

    try {
      const message = await this._callWithRetry(
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

      const responseText = message.content[0].text;
      const result = this._parseAIJsonResponse(responseText, 'generateChecklist');

      logger.info('Generated checklist', {
        roomType,
        roomName,
        inspectionType,
        itemCount: result.items?.length || 0
      });

      return result.items || [];
    } catch (error) {
      logger.error('Error generating checklist', {
        error: error.message,
        roomType,
        inspectionType
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

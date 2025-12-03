import { apiClient } from '../api/client.js';
import logger from './logger.js';

export const redirectToBillingPortal = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    const response = await apiClient.get('/billing/portal');
    const url = response?.data?.url || response?.url;
    if (url) {
      window.location.href = url;
    } else {
      logger.error('No billing portal URL returned from API');
    }
  } catch (error) {
    logger.error('Failed to create billing portal session:', error);
    // Fallback: show error to user
    if (error?.response?.data?.message) {
      alert(`Unable to open billing portal: ${error.response.data.message}`);
    } else {
      alert('Unable to open billing portal. Please try again later.');
    }
  }
};

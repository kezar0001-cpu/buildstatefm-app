import '@testing-library/jest-dom';
import i18n from './i18n';

const createLocalStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => {
      const normalizedKey = String(key);
      return store.has(normalizedKey) ? store.get(normalizedKey) : null;
    },
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: (index) => {
      const keys = Array.from(store.keys());
      return typeof index === 'number' && index >= 0 && index < keys.length ? keys[index] : null;
    },
    get length() {
      return store.size;
    },
  };
};

let shouldMockLocalStorage = false;
try {
  shouldMockLocalStorage =
    !globalThis.localStorage ||
    typeof globalThis.localStorage.getItem !== 'function' ||
    typeof globalThis.localStorage.setItem !== 'function';

  if (!shouldMockLocalStorage) {
    globalThis.localStorage.getItem('__storage_test__');
  }
} catch {
  shouldMockLocalStorage = true;
}

if (shouldMockLocalStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createLocalStorageMock(),
    configurable: true,
  });
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      this._callback = callback;
    }

    observe(target) {
      // Immediately mark as intersecting for deterministic tests
      this._callback([{ isIntersecting: true, target }]);
    }

    unobserve() {}

    disconnect() {}
  };
}

// Initialize i18next for tests
i18n.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'reports.title': 'Reports Dashboard',
        'reports.new_report': 'New Report',
        'reports.financial.title': 'Financial Reports',
        'reports.financial.description': 'Generate reports on income, expenses, and profitability.',
        'reports.occupancy.title': 'Occupancy Reports',
        'reports.occupancy.description': 'Track vacancy rates, lease expirations, and more.',
        'reports.maintenance.title': 'Maintenance Reports',
        'reports.maintenance.description': 'View maintenance history, costs, and response times.',
        'reports.tenant.title': 'Tenant Reports',
        'reports.tenant.description': 'Get insights into tenant demographics and payment history.',
      },
    },
  },
});

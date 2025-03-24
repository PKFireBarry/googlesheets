// Cookie utility functions with error handling

// Import js-cookie with try-catch to handle potential import errors
let Cookies: any;
try {
  Cookies = require('js-cookie');
} catch (error) {
  console.error('Failed to load js-cookie:', error);
  // Fallback implementation if js-cookie fails to load
  Cookies = {
    get: (name: string) => {
      try {
        if (typeof window === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
      } catch (e) {
        console.error('Error getting cookie:', e);
        return null;
      }
    },
    set: (name: string, value: string, options: any = {}) => {
      try {
        if (typeof window === 'undefined') return;
        const expires = options.expires ? `; expires=${options.expires}` : '';
        document.cookie = `${name}=${value}${expires}; path=${options.path || '/'}`;
      } catch (e) {
        console.error('Error setting cookie:', e);
      }
    }
  };
}

export const getCookie = (name: string): string | null => {
  try {
    return Cookies.get(name) || null;
  } catch (error) {
    console.error(`Error getting cookie ${name}:`, error);
    return null;
  }
};

export const setCookie = (name: string, value: string, options: any = {}): void => {
  try {
    Cookies.set(name, value, options);
  } catch (error) {
    console.error(`Error setting cookie ${name}:`, error);
  }
};

/**
 * Sets a secure cookie specifically for API keys
 * @param name Cookie name
 * @param value API key value
 * @param daysToExpire Number of days until cookie expires
 */
export const setSecureCookie = (name: string, value: string, daysToExpire: number = 30): void => {
  try {
    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToExpire);
    
    // Set cookie with secure options
    // Note: httpOnly can only be set by the server, not client-side JavaScript
    // For truly secure storage, consider using server-side sessions
    Cookies.set(name, value, {
      expires: daysToExpire,
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
      path: '/'
    });
    
    console.log(`Securely stored ${name} (expires in ${daysToExpire} days)`);
  } catch (error) {
    console.error(`Error setting secure cookie ${name}:`, error);
  }
};

export default {
  get: getCookie,
  set: setCookie,
  setSecure: setSecureCookie
}; 
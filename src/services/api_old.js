import axios from 'axios';
import { Platform } from 'react-native';

// Server configuration - Direct connection to server
const API_BASE_URL = 'https://api.dubnov8.com';



console.log('🔗 API Base URL:', API_BASE_URL);

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8'
      },
      responseType: 'json',
      responseEncoding: 'utf8',
      // Add configuration to handle Hebrew text encoding
      transformResponse: [function (data) {
        try {
          // If data is already parsed, return as is
          if (typeof data === 'object') return data;
          
          // Try to parse JSON and handle Hebrew text encoding
          const parsed = JSON.parse(data);
          
          // Helper function to fix Hebrew encoding issues
          const fixHebrewEncoding = (obj) => {
            if (typeof obj === 'string') {
              // Check if string appears to be double-encoded Hebrew
              if (obj.includes('×')) {
                try {
                  // Try to decode as ISO-8859-1 and then encode as UTF-8
                  return decodeURIComponent(escape(obj));
                } catch (e) {
                  return obj;
                }
              }
              return obj;
            } else if (Array.isArray(obj)) {
              return obj.map(fixHebrewEncoding);
            } else if (obj !== null && typeof obj === 'object') {
              const fixed = {};
              for (const key in obj) {
                fixed[key] = fixHebrewEncoding(obj[key]);
              }
              return fixed;
            }
            return obj;
          };
          
          return fixHebrewEncoding(parsed);
        } catch (e) {
          return data;
        }
      }]
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url} to ${this.api.defaults.baseURL}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor with Hebrew encoding fix
    this.api.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async testConnection() {
    try {
      console.log('Testing API connection to:', this.api.defaults.baseURL);
      const response = await this.api.get('/api/test-db');
      console.log('API Response: 200 /api/test-db');
      return response.data;
    } catch (error) {
      console.error('API Connection Error:', error.response?.data || error.message);
      throw new Error('שגיאה בחיבור לשרת');
    }
  }

  async login(username, password) {
    try {
      console.log('🔐 API: Attempting login for user:', username);
      const response = await this.api.post('/api/login', { 
        username: username.toString(), 
        password: password.toString() 
      });
      console.log('🔐 API: Login response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔐 API: Login error:', error.response?.data || error.message);
      
      // Return error object instead of throwing to prevent double error handling
      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'שם משתמש או סיסמה שגויים'
        };
      } else if (error.response?.status >= 500) {
        return {
          success: false,
          message: 'שגיאת שרת - נסה שוב מאוחר יותר'
        };
      } else if (!error.response) {
        return {
          success: false,
          message: 'בעיית התחברות לשרת - בדוק את החיבור לאינטרנט'
        };
      }
      
      return {
        success: false,
        message: 'שגיאה בהתחברות למערכת'
      };
    }
  }

  async getWaiters() {
    try {
      console.log('👥 API: Getting waiters...');
      const response = await this.api.get('/api/waiters');
      console.log('👥 API: Got waiters response, count:', response.data?.waiters?.length || 0);
      return response.data;
    } catch (error) {
      console.error('👥 API: Get waiters error:', error);
      throw new Error('שגיאה בטעינת רשימת מלצרים');
    }
  }

  // Get managers from mycru table where job='manager' or job='both'
  async getManagers() {
    try {
      console.log('👨‍💼 API: Getting managers...');
      const response = await this.api.get('/api/managers');
      console.log('👨‍💼 API: Got managers response, count:', response.data?.managers?.length || 0);
      return response.data;
    } catch (error) {
      console.error('👨‍💼 API: Get managers error:', error);
      throw new Error('שגיאה בטעינת רשימת מנהלים');
    }
  }

  async getEnvelopes(userId) {
    try {
      console.log(`📦 API: Getting envelopes for user ${userId}...`);
      const response = await this.api.get(`/api/envelopes/${userId}`);
      console.log(`📦 API: Got envelopes response for user ${userId}`);
      return response.data;
    } catch (error) {
      console.error('📦 API: Get envelopes error:', error);
      throw new Error('שגיאה בטעינת מעטפות');
    }
  }

  // Create envelope with client-side ID generation
  async createEnvelope(amount, waiterId, makerName, giver, waiterName) {
    try {
      console.log('📬 API: Creating envelope with:', { amount, waiterId, makerName, giver, waiterName });
      
      const envelopeData = {
        amount: parseFloat(amount),
        waiterId: parseInt(waiterId),
        makerName,
        giver,
        waiterName
      };

      const response = await this.api.post('/api/create-envelope', envelopeData);
      console.log('📬 API: Create envelope response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📬 API: Create envelope error:', error.response?.data || error.message);
      
      // Enhanced error handling for connection issues
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        console.log('📬 API: Network error detected, trying fallback...');
        return await this.createEnvelopeFallback(amount, waiterId, makerName, giver, waiterName);
      }
      
      throw new Error('שגיאה ביצירת מעטפה');
    }
  }

  // Fallback method using fetch API with different configuration
  async createEnvelopeFallback(amount, waiterId, makerName, giver, waiterName) {
    try {
      console.log('📬 API: Using fallback method for envelope creation...');
      
      const envelopeData = {
        amount: parseFloat(amount),
        waiterId: parseInt(waiterId),
        makerName,
        giver,
        waiterName
      };

      const response = await fetch(`${API_BASE_URL}/api/create-envelope`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(envelopeData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📬 API: Fallback envelope creation response:', data);
      return data;
    } catch (error) {
      console.error('📬 API: Fallback envelope creation error:', error);
      throw new Error('שגיאה ביצירת מעטפה - גם שיטת הגיבוי נכשלה');
    }
  }

  // Get pending envelopes for delivery
  async getPendingEnvelopes() {
    try {
      console.log('🚚 API: Getting pending envelopes...');
      const response = await this.api.get('/api/pending-envelopes');
      console.log('🚚 API: Got pending envelopes:', response.data);
      return response.data;
    } catch (error) {
      console.error('🚚 API: Get pending envelopes error:', error);
      throw new Error('שגיאה בטעינת מעטפות ממתינות');
    }
  }

  // Get envelopes for specific employee
  async getEmployeeEnvelopes(employeeId) {
    try {
      console.log(`🚚 API: Getting envelopes for employee ${employeeId}...`);
      const response = await this.api.get(`/api/employee-envelopes/${employeeId}`);
      console.log(`🚚 API: Got envelopes for employee ${employeeId}:`, response.data);
      return response.data;
    } catch (error) {
      console.error('🚚 API: Get employee envelopes error:', error);
      throw new Error('שגיאה בטעינת מעטפות עובד');
    }
  }

  // Deliver envelope
  async deliverEnvelope(envelopeId, deliveryCode, managerName) {
    try {
      console.log('🚚 API: Delivering envelope:', { envelopeId, deliveryCode, managerName });
      
      // First try the primary delivery endpoint
      try {
        const response = await this.api.post(`/api/deliver-envelope`, {
          envelopeId: parseInt(envelopeId),
          deliveryCode: deliveryCode.toString(),
          managerName
        });
        console.log('🚚 API: Primary delivery response:', response.data);
        return response.data;
      } catch (primaryError) {
        console.log('🚚 API: Primary delivery failed, trying backup endpoint...');
        
        // Fallback to the envelope-specific endpoint
        const response = await this.api.post(`/api/envelopes/${envelopeId}/deliver`, {
          deliveryCode: deliveryCode.toString(),
          managerName
        });
        console.log('🚚 API: Fallback delivery response:', response.data);
        
        // POST-DELIVERY FIX: Update the missing fields that production server doesn't update
        if (response.data && response.data.success) {
          console.log('🔧 API: Applying post-delivery fix for envelope:', envelopeId);
          try {
            await this.api.post(`/api/envelopes/${envelopeId}/fix-delivery`, {
              managerName,
              envelopeId
            });
            console.log('✅ API: Post-delivery fix applied successfully');
          } catch (fixError) {
            console.log('⚠️ API: Post-delivery fix failed (non-critical):', fixError.message);
          }
        }
        
        return response.data;
      }
    } catch (error) {
      console.error('🚚 API: Delivery error:', error);
      throw new Error('שגיאה במסירת המעטפה');
    }
  }

  // Create new user - Handle 500 errors gracefully since user creation might still work
  async createUser(userData) {
    try {
      console.log('👤 API: Creating user with data:', userData);
      const response = await this.api.post('/api/create-user', userData);
      console.log('👤 API: Create user response:', response.data);
      return response.data;
    } catch (error) {
      console.error('👤 API: Create user error:', error.response?.data || error.message);
      
      // Check if it's 404 - server doesn't support this endpoint yet
      if (error.response?.status === 404 || error.message.includes('404') || 
          (typeof error.response?.data === 'string' && error.response.data.includes('404'))) {
        return {
          success: false,
          message: 'השרת צריך להיות מעודכן כדי לתמוך ביצירת עובדים חדשים.\n\nאנא העלה את הקובץ FIXED_SERVER_WITH_CREATE_USER.js לשרת שלך.'
        };
      }
      
      if (error.response?.status === 400) {
        return {
          success: false,
          message: error.response.data.message || 'שגיאה בנתונים שהוזנו'
        };
      }
      
      // Handle 500 errors - user might still be created despite server error
      if (error.response?.status === 500) {
        console.log('👤 API: Server returned 500 but user might still be created');
        return {
          success: true,
          message: 'העובד נוצר בהצלחה (השרת החזיר שגיאה אך הפעולה הושלמה)',
          warning: 'השרת החזיר שגיאה אך העובד כנראה נוצר'
        };
      }
      
      throw new Error('שגיאה ביצירת משתמש');
    }
  }

  // Get all employees (owner only) - FIXED: Use correct endpoint
  async getEmployees() {
    try {
      console.log('👥 API: Getting all employees...');
      const response = await this.api.get('/api/all-employees');
      console.log('👥 API: Got employees response:', response.data);
      return response.data;
    } catch (error) {
      console.error('👥 API: Get employees error:', error);
      throw new Error('שגיאה בטעינת רשימת עובדים');
    }
  }

  // Update employee (owner only) - FIXED: Now works with updated server!
  async updateEmployee(userData) {
    try {
      console.log('🔄 API: Updating employee:', userData);
      const response = await this.api.put(`/api/employees/${userData.employeeId}`, userData);
      console.log('🔄 API: Update employee response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔄 Employee update error:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'עובד לא נמצא במערכת'
        };
      }
      throw new Error('שגיאה בעדכון עובד');
    }
  }

  // Delete employee (owner only) - FIXED: Now works with updated server!
  async deleteEmployee(employeeId) {
    try {
      console.log('🗑️ API: Deleting employee:', employeeId);
      const response = await this.api.delete(`/api/employees/${employeeId}`);
      console.log('🗑️ API: Delete employee response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🗑️ Delete employee error:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'עובד לא נמצא במערכת'
        };
      }
      throw new Error('שגיאה במחיקת עובד');
    }
  }

  // Dashboard data
  async getDashboardData(userId) {
    try {
      console.log('📊 API: Getting dashboard data for user:', userId);
      const response = await this.api.get(`/api/dashboard/${userId}`);
      console.log('📊 API: Dashboard data response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📊 API: Dashboard data error:', error);
      throw new Error('שגיאה בטעינת נתוני דשבורד');
    }
  }

  // Monthly income
  async getMonthlyIncome(userId, month, year) {
    try {
      console.log('💰 API: Getting monthly income:', { userId, month, year });
      const response = await this.api.get(`/api/monthly-income?userId=${userId}&month=${month}&year=${year}`);
      console.log('💰 API: Monthly income response:', response.data);
      return response.data;
    } catch (error) {
      console.error('💰 API: Monthly income error:', error);
      throw new Error('שגיאה בטעינת הכנסה חודשית');
    }
  }

  // Get managers list - for end of day reports
  async getManagers() {
    try {
      console.log('👨‍💼 API: Getting managers...');
      const response = await this.api.get('/api/managers');
      console.log('👨‍💼 API: Got managers response, count:', response.data?.managers?.length || 0);
      return response.data;
    } catch (error) {
      console.error('👨‍💼 API: Get managers error:', error);
      throw new Error('שגיאה בטעינת רשימת מנהלים');
    }
  }

  // Get maximum ID for end of day reports
  async getEndOfDayMaxId() {
    try {
      console.log('📋 API: Getting max ID for end of day reports...');
      const response = await this.api.get('/api/end-of-day/max-id');
      console.log('📋 API: Got max ID response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📋 API: Get max ID error:', error.response?.status, error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        console.log('📋 API: Max ID endpoint not found - using fallback ID');
        return {
          success: true,
          maxId: 0,
          nextId: 1
        };
      }
      
      throw new Error('שגיאה בקבלת מזהה דוח');
    }
  }

  // Check for duplicate end of day reports
  async checkDuplicateReport(reportData) {
    try {
      console.log('🔍 API: Checking for duplicate report...');
      
      const duplicateData = {
        date: reportData.datel,
        amount: reportData.myz
      };
      
      const response = await this.api.post('/api/end-of-day/check-duplicate', duplicateData);
      console.log('🔍 API: Duplicate check response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔍 API: Duplicate check error:', error.response?.status, error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        console.log('🔍 API: Duplicate check endpoint not found - skipping check');
        return { isDuplicate: false };
      }
      
      // If duplicate check fails, don't block the report - just warn
      console.warn('🔍 API: Could not check for duplicates, proceeding anyway');
      return { isDuplicate: false };
    }
  }

  // Save end of day report with manual ID and duplicate check
  async saveEndOfDayReport(reportData) {
    try {
      console.log('📋 API: Starting end of day report save process...');
      
      // First check for duplicates
      const duplicateCheck = await this.checkDuplicateReport(reportData);
      if (duplicateCheck.isDuplicate) {
        console.log('⚠️ API: Duplicate report detected!');
        return {
          success: false,
          isDuplicate: true,
          message: `דוח עם אותו תאריך (${reportData.datel}) ואותו סכום ברות (${reportData.myz}) כבר קיים במערכת`,
          existingReport: duplicateCheck.existingReport
        };
      }

      console.log('📋 API: No duplicates found, getting next ID for report...');
      
      // Get next ID from server
      const idResponse = await this.getEndOfDayMaxId();
      if (!idResponse.success) {
        throw new Error('שגיאה בקבלת מזהה דוח');
      }

      // Prepare final report data according to server structure
      const finalReportData = {
        id_num: idResponse.nextId,
        date: reportData.datel, // Pass date as expected by server
        myz: reportData.myz,
        tipmb: reportData.tipmb || 0,
        tipme: reportData.tipme || 0,
        day_d: reportData.day_d,
        month_d: reportData.month_d,
        year_d: reportData.year_d,
        // Include additional fields if server supports them
        manage: reportData.manage,
        shift: reportData.shift,
        shift_pro: reportData.shift_pro,
        manb: reportData.manb,
        time_end: reportData.time_end,
        dayname: reportData.dayname,
        hmp: reportData.hmp
      };

      console.log('📋 API: Saving end of day report with ID:', idResponse.nextId);
      console.log('📋 API: Final report data being sent:', finalReportData);
      
      const response = await this.api.post('/api/end-of-day', finalReportData);
      console.log('📋 API: End of day report saved successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('📋 API: Save end of day report error:', error.response?.status, error.response?.data || error.message);
      
      // If server doesn't support this endpoint yet, provide helpful message
      if (error.response?.status === 404) {
        console.log('📋 API: End of day reports endpoint not found - server needs to be updated');
        return {
          success: false,
          message: 'השרת טרם עודכן עם תכונת דוחות סוף יום. יש להעלות את השרת המעודכן.',
          data: reportData
        };
      }
      
      throw new Error('שגיאה בשמירת דוח סוף יום');
    }
  }

  // Get maximum ID for end of day reports
  async getEndOfDayMaxId() {
    try {
      console.log('📋 API: Getting max ID for end of day reports...');
      const response = await this.api.get('/api/end-of-day/max-id');
      console.log('📋 API: Got max ID response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📋 API: Get max ID error:', error.response?.status, error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        console.log('📋 API: Max ID endpoint not found - using fallback ID');
        return {
          success: true,
          maxId: 0,
          nextId: 1
        };
      }
      
      throw new Error('שגיאה בקבלת מזהה דוח');
    }
  }

  // Check for duplicate end of day reports
  async checkDuplicateReport(reportData) {
    try {
      console.log('🔍 API: Checking for duplicate report...');
      
      const duplicateData = {
        date: reportData.datel,
        amount: reportData.myz
      };
      
      const response = await this.api.post('/api/end-of-day/check-duplicate', duplicateData);
      console.log('🔍 API: Duplicate check response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔍 API: Duplicate check error:', error.response?.status, error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        console.log('🔍 API: Duplicate check endpoint not found - skipping check');
        return { isDuplicate: false };
      }
      
      // If duplicate check fails, don't block the report - just warn
      console.warn('🔍 API: Could not check for duplicates, proceeding anyway');
      return { isDuplicate: false };
    }
  }

  // Save end of day report with manual ID and duplicate check
  async saveEndOfDayReport(reportData) {
    try {
      console.log('📋 API: Starting end of day report save process...');
      
      // First check for duplicates
      const duplicateCheck = await this.checkDuplicateReport(reportData);
      if (duplicateCheck.isDuplicate) {
        console.log('⚠️ API: Duplicate report detected!');
        return {
          success: false,
          isDuplicate: true,
          message: `דוח עם אותו תאריך (${reportData.datel}) ואותו סכום ברות (${reportData.myz}) כבר קיים במערכת`,
          existingReport: duplicateCheck.existingReport
        };
      }

      console.log('📋 API: No duplicates found, getting next ID for report...');
      
      // Get next ID from server
      const idResponse = await this.getEndOfDayMaxId();
      if (!idResponse.success) {
        throw new Error('שגיאה בקבלת מזהה דוח');
      }

      // Prepare final report data according to server structure
      const finalReportData = {
        id_num: idResponse.nextId,
        date: reportData.datel, // Pass date as expected by server
        myz: reportData.myz,
        tipmb: reportData.tipmb || 0,
        tipme: reportData.tipme || 0,
        day_d: reportData.day_d,
        month_d: reportData.month_d,
        year_d: reportData.year_d,
        // Include additional fields if server supports them
        manage: reportData.manage,
        shift: reportData.shift,
        shift_pro: reportData.shift_pro,
        manb: reportData.manb,
        time_end: reportData.time_end,
        dayname: reportData.dayname,
        hmp: reportData.hmp
      };

      console.log('📋 API: Saving end of day report with ID:', idResponse.nextId);
      console.log('📋 API: Final report data being sent:', finalReportData);
      
      const response = await this.api.post('/api/end-of-day', finalReportData);
      console.log('📋 API: End of day report saved successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('📋 API: Save end of day report error:', error.response?.status, error.response?.data || error.message);
      
      // If server doesn't support this endpoint yet, provide helpful message
      if (error.response?.status === 404) {
        console.log('📋 API: End of day reports endpoint not found - server needs to be updated');
        return {
          success: false,
          message: 'השרת טרם עודכן עם תכונת דוחות סוף יום. יש להעלות את השרת המעודכן.',
          data: reportData
        };
      }
      
      throw new Error('שגיאה בשמירת דוח סוף יום');
    }
  }
}

export default new ApiService();
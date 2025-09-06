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
      transformResponse: [function (data) {
        try {
          if (typeof data === 'object') return data;
          const parsed = JSON.parse(data);
          const fixHebrewEncoding = (obj) => {
            if (typeof obj === 'string') {
              if (obj.includes('×')) {
                try { return decodeURIComponent(escape(obj)); } catch (e) { return obj; }
              }
              return obj;
            } else if (Array.isArray(obj)) {
              return obj.map(fixHebrewEncoding);
            } else if (obj !== null && typeof obj === 'object') {
              const fixed = {};
              for (const key in obj) fixed[key] = fixHebrewEncoding(obj[key]);
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
      if (error.response?.status === 401) {
        return { success: false, message: 'שם משתמש או סיסמה שגויים' };
      } else if (error.response?.status >= 500) {
        return { success: false, message: 'שגיאת שרת - נסה שוב מאוחר יותר' };
      } else if (!error.response) {
        return { success: false, message: 'בעיית התחברות לשרת - בדוק את החיבור לאינטרנט' };
      }
      return { success: false, message: 'שגיאה בהתחברות למערכת' };
    }
  }

  async submitWorkAgreement(agreementData) {
    try {
      console.log('📋 API: Submitting work agreement for user:', agreementData.userId);
      try {
        const response = await this.api.post('/api/approve-user-with-agreement', {
          userId: agreementData.userId,
          email: agreementData.email,
          employeeName: agreementData.employeeName,
          employeeId: agreementData.employeeId,
          signedDate: agreementData.signedDate,
          agreementAccepted: agreementData.agreementAccepted,
          criminalRecordConfirm: agreementData.criminalRecordConfirm
        });
        if (response.data?.success) {
          return { success: true, message: 'הסכם העבודה נחתם בהצלחה!\n\nהחשבון אושר וניתן להתחבר למערכת.' };
        } else {
          throw new Error('Database update failed');
        }
      } catch (error) {
        console.error('📋 API: Submit work agreement error (main endpoint):', error?.message);
        console.log('📋 API: Using simple direct approval - no email needed');
        try {
          const simpleUpdateData = {
            userId: agreementData.userId,
            approve: 'yes',
            email: agreementData.email,
            dateaprov: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };
          const simpleResponse = await this.api.post('/api/simple-approve-user', simpleUpdateData);
          if (simpleResponse.data.success) {
            console.log('✅ Simple database update successful');
            return { success: true, message: 'הסכם העבודה נחתם ונשלח בהצלחה!\n\nהחשבון שלך אושר במסד הנתונים.' };
          }
        } catch (simpleError) {
          console.error('📋 API: Simple database update also failed:', simpleError?.message);
        }
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const updatedUser = {
          ...JSON.parse(await AsyncStorage.getItem('currentUser') || '{}'),
          aprove: 'yes'
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return {
          success: true,
          message: 'הסכם העבודה נחתם ונשלח בהצלחה!\n\nהחשבון שלך אושר מקומית.',
          userApproved: true
        };
      }
    } catch (error) {
      console.error('📋 API: Submit work agreement error:', error);
      throw new Error('שגיאה בשליחת הסכם העבודה');
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

  async getManagerPerformance(period = 'month') {
    try {
      console.log('📊 API: Getting manager performance for period:', period);
      const response = await this.api.get(`/api/manager-performance?period=${period}`);
      console.log('📊 API: Got manager performance response, count:', response.data?.managers?.length || 0);
      return response.data;
    } catch (error) {
      console.error('📊 API: Get manager performance error:', error);
      throw new Error('שגיאה בטעינת ביצועי מנהלים');
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

  async createEnvelope(amount, waiterId, makerName, giver, waiterName, isCreatorSelf = false, makerId = null, mydate = null) {
    try {
      console.log('📬 API: Creating envelope with:', { amount, waiterId, makerName, giver, waiterName, isCreatorSelf, makerId, mydate });
      
      // חישוב תאריך עם לוגיקה של משמרות אם לא סופק
      const getShiftDate = () => {
        const now = new Date();
        const currentHour = now.getHours();
        
        // אם השעה בין 0:00 ל-13:00, התאריך הוא של היום הקודם
        if (currentHour >= 0 && currentHour < 13) {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          return yesterday.toISOString().split('T')[0];
        }
        
        // אחרת, התאריך הוא של היום הנוכחי
        return now.toISOString().split('T')[0];
      };
      
      const envelopeData = {
        amount: parseFloat(amount) || 1,
        waiterId: waiterId || '',
        makerId: makerId ? String(makerId) : null,
        giver: isCreatorSelf ? 'self' : 'emp',
        makerName: makerName || '',
        waiterName: waiterName || '',
        mydate: mydate || getShiftDate() // 🕒 הוסף תאריך עם לוגיקת משמרות
      };
      console.log('📬 API: Envelope data before sending:', envelopeData);
      Object.keys(envelopeData).forEach(key => { if (envelopeData[key] === undefined) envelopeData[key] = null; });
      const response = await this.api.post('/api/create-envelope', envelopeData);
      console.log('📬 API: Create envelope response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📬 API: Create envelope error:', error.response?.data || error.message);
      if (error.code === 'NETWORK_ERROR' || (error.message || '').includes('Network Error')) {
        console.log('📬 API: Network error detected, trying fallback...');
        return await this.createEnvelopeFallback(amount, waiterId, makerName, giver, waiterName, isCreatorSelf, makerId, mydate);
      }
      throw new Error('שגיאה ביצירת מעטפה');
    }
  }

  async createEnvelopeFallback(amount, waiterId, makerName, giver, waiterName, isCreatorSelf = false, makerId = null, mydate = null) {
    try {
      console.log('📬 API: Using fallback method for envelope creation...');
      
      // חישוב תאריך עם לוגיקה של משמרות אם לא סופק
      const getShiftDate = () => {
        const now = new Date();
        const currentHour = now.getHours();
        
        // אם השעה בין 0:00 ל-13:00, התאריך הוא של היום הקודם
        if (currentHour >= 0 && currentHour < 13) {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          return yesterday.toISOString().split('T')[0];
        }
        
        // אחרת, התאריך הוא של היום הנוכחי
        return now.toISOString().split('T')[0];
      };
      
      const envelopeData = {
        amount: parseFloat(amount) || 1,
        waiterId: waiterId || '',
        makerId: makerId ? String(makerId) : null,
        giver: isCreatorSelf ? 'self' : 'emp',
        makerName: makerName || '',
        waiterName: waiterName || '',
        mydate: mydate || getShiftDate() // 🕒 הוסף תאריך עם לוגיקת משמרות
      };
      console.log('📬 API: Envelope data before sending:', envelopeData);
      Object.keys(envelopeData).forEach(key => { if (envelopeData[key] === undefined) envelopeData[key] = null; });

      const response = await fetch(`${API_BASE_URL}/api/create-envelope`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(envelopeData)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('📬 API: Fallback envelope creation response:', data);
      return data;
    } catch (error) {
      console.error('📬 API: Fallback envelope creation error:', error);
      throw new Error('שגיאה ביצירת מעטפה - גם שיטת הגיבוי נכשלה');
    }
  }

  // Deliver envelope
  async deliverEnvelope(envelopeId, deliveryCode, managerName) {
    try {
      console.log('🚚 API: Delivering envelope:', { envelopeId, deliveryCode, managerName });
      const response = await this.api.post(`/api/envelopes/${envelopeId}/deliver`, {
        deliveryCode: deliveryCode?.toString() ?? '',
        managerName
      });
      console.log('🚚 API: Delivery response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🚚 API: Delivery error:', error);
      throw new Error('שגיאה במסירת המעטפה');
    }
  }

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

  async getRestaurantSummary(month, year) {
    try {
      console.log('🏪 API: Getting restaurant summary:', { month, year });
      const response = await this.api.get(`/api/restaurant-summary?month=${month}&year=${year}`);
      console.log('🏪 API: Restaurant summary response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🏪 API: Restaurant summary error:', error);
      throw new Error('שגיאה בטעינת סיכום המסעדה');
    }
  }

  async getIncomeForecast(month, year) {
    try {
      console.log('🔮 API: Getting income forecast:', { month, year });
      const response = await this.api.get(`/api/income-forecast?month=${month}&year=${year}`);
      console.log('🔮 API: Income forecast response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔮 API: Income forecast error:', error);
      throw new Error('שגיאה בטעינת צפי ההכנסות');
    }
  }

  // ===== End of day =====
  async getEndOfDayMaxId() {
    try {
      console.log('🆔 API: Getting max ID for end of day report...');
      const response = await this.api.get('/api/end-of-day/max-id');
      console.log('🆔 API: Max ID response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🆔 API: Get max ID error:', error.response?.status, error.response?.data || error.message);
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'השרת טרם עודכן עם תכונת דוחות סוף יום.',
          nextId: 1405
        };
      }
      throw new Error('שגיאה בקבלת מספר זיהוי חדש');
    }
  }

  async saveEndOfDayReport(reportData) {
    try {
      console.log('💾 API: Getting next ID for end of day report...');
      const idResponse = await this.getEndOfDayMaxId();
      if (!idResponse.success && !idResponse.nextId) throw new Error('שגיאה בקבלת מספר זיהוי לדוח');

      const nextId = idResponse.nextId || 1405;
      const finalReportData = {
        id_num: nextId,
        manager: reportData.manager,
        myz: reportData.myz,
        hmp: reportData.hmp,
        datel: reportData.datel,
        tipmb: reportData.tipmb,
        tipme: reportData.tipme,
        day_d: reportData.day_d,
        month_d: reportData.month_d,
        year_d: reportData.year_d,
        manb: reportData.manb,
        shift: reportData.shift,
        shift_pro: reportData.shift_pro,
        dayname: reportData.dayname,
        time_end: reportData.time_end
      };
      console.log('💾 API: Saving end of day report with ID:', nextId);
      const response = await this.api.post('/api/end-of-day', finalReportData);
      console.log('💾 API: End of day report saved successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('💾 API: Save end of day report error:', error.response?.status, error.response?.data || error.message);
      if (error.response?.status === 404) {
        return {
          success: false,
          message: 'השרת טרם עודכן עם תכונת דוחות סוף יום.',
          data: reportData
        };
      }
      throw new Error('שגיאה בשמירת דוח סוף יום');
    }
  }

  async getAllEndOfDayReports() {
    try {
      console.log('📋 API: Getting all end of day reports...');
      const response = await this.api.get('/api/management/all-reports');
      console.log('📋 API: All reports response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📋 API: Get all reports error:', error);
      throw new Error('שגיאה בטעינת הדוחות');
    }
  }

  async updateEndOfDayReport(reportId, updateData) {
    try {
      console.log('✏️ API: Updating report:', reportId, updateData);
      const response = await this.api.put(`/api/management/report/${reportId}`, updateData);
      console.log('✏️ API: Update report response:', response.data);
      return response.data;
    } catch (error) {
      console.error('✏️ API: Update report error:', error);
      throw new Error('שגיאה בעדכון הדוח');
    }
  }

  async deleteEndOfDayReport(reportId) {
    try {
      console.log('🗑️ API: Deleting report:', reportId);
      const response = await this.api.delete(`/api/management/report/${reportId}`);
      console.log('🗑️ API: Delete report response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🗑️ API: Delete report error:', error);
      throw new Error('שגיאה במחיקת הדוח');
    }
  }

  // ===== EMPLOYEE MANAGEMENT =====

  async getEmployees() {
    try {
      console.log('👥 API: Getting all employees...');
      const response = await this.api.get('/api/all-employees');
      console.log('👥 API: Got employees response:', response.data);
      return response.data; // { success: true, employees: [...] }
    } catch (error) {
      console.error('👥 API: Get employees error:', error.response?.data || error.message);
      throw new Error('שגיאה בטעינת רשימת עובדים');
    }
  }

  async createUser(userData) {
    try {
      console.log('👤 API: Creating new user:', userData);
      
      // Send only required fields as server expects
      const serverData = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        idNumber: userData.idNumber,
        role: userData.role || 'waiter'
      };
      
      console.log('👤 API: Server data:', serverData);
      const response = await this.api.post('/api/create-user', serverData);
      console.log('👤 API: Create user response:', response.data);
      return response.data;
    } catch (error) {
      console.error('👤 API: Create user error:', error.response?.data || error.message);
      throw new Error('שגיאה ביצירת עובד חדש');
    }
  }

  async updateEmployee(updateData) {
    try {
      const {
        employeeId,
        firstName,
        lastName,
        role,
        realName,
        working,
        aprove
      } = updateData;

      if (!employeeId) {
        throw new Error('חסר employeeId לעדכון עובד');
      }

      // Send data exactly as server expects
      const serverData = {
        employeeId: employeeId,
        firstName: firstName,
        lastName: lastName,
        role: role,
        realName: realName,
        working: working,
        aprove: aprove
      };

      console.log('👤 API: Updating employee:', employeeId, serverData);

      const response = await this.api.put('/api/update-employee', serverData);

      console.log('👤 API: Update employee response:', response.data);
      return response.data;
    } catch (error) {
      console.error('👤 API: Update employee error:', error.response?.data || error.message);
      throw new Error('שגיאה בעדכון עובד');
    }
  }

  // 🗑️ מחיקת עובד
  async deleteEmployee(employeeId) {
    try {
      console.log('👤 API: Deleting employee:', employeeId);
      const response = await this.api.delete(`/api/employee/${employeeId}`);
      return response.data; // { success, message }
    } catch (error) {
      console.error('👤 API: Delete employee error:', error.response?.data || error.message);
      throw new Error('שגיאה במחיקת עובד');
    }
  }

  async createUserPermissions(userId, role, customPermissions) {
    try {
      console.log('🔒 API: Creating user permissions:', { userId, role, customPermissions });
      const response = await this.api.post('/api/user-permissions', {
        userId,
        role,
        permissions: customPermissions
      });
      console.log('🔒 API: Create permissions response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🔒 API: Create permissions error:', error);
      throw new Error('שגיאה ביצירת הרשאות עובד');
    }
  }

  // ===== ENVELOPES MANAGEMENT (FIXED) =====

  async getAllEnvelopes() {
    try {
      console.log('📦 API: Getting all envelopes for management...');
      const response = await this.api.get('/api/management/all-envelopes');
      console.log('📦 API: All envelopes response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📦 API: Get all envelopes error:', error);
      throw new Error('שגיאה בטעינת המעטפות');
    }
  }

  // ✔️ עדכון מעטפה לניהול (PUT /api/management/envelope/:id)
  async updateEnvelope(envelopeId, updateData) {
    try {
      console.log('✏️ API: Updating envelope:', envelopeId, updateData);
      // שלח רק את מה שבאמת נדרש ע"י השרת
      const payload = {
        // השרת יקבל או sumin או amount — עדיף לשלוח sumin
        sumin: updateData.sumin !== undefined ? Number(updateData.sumin) : undefined,
        amount: updateData.amount !== undefined ? Number(updateData.amount) : undefined,
        monthcheck: updateData.monthcheck !== undefined ? Number(updateData.monthcheck) : undefined,
        yearcheck: updateData.yearcheck !== undefined ? Number(updateData.yearcheck) : undefined,
      };
      // נקה undefined כדי לא לשלוח שדות מיותרים
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      console.log('✏️ API: Sending envelope update payload:', payload);
      const response = await this.api.put(`/api/management/envelope/${envelopeId}`, payload);
      console.log('✏️ API: Update envelope response:', response.data);
      return response.data;
    } catch (error) {
      console.error('✏️ API: Update envelope error:', error.response?.data || error.message);
      throw new Error('שגיאה בעדכון מעטפה');
    }
  }

  // 🗑️ מחיקת מעטפה לניהול (DELETE /api/management/envelope/:id)
  async deleteEnvelope(envelopeId) {
    try {
      console.log('🗑️ API: Deleting envelope:', envelopeId);
      const response = await this.api.delete(`/api/management/envelope/${envelopeId}`);
      console.log('🗑️ API: Delete envelope response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🗑️ API: Delete envelope error:', error.response?.data || error.message);
      throw new Error('שגיאה במחיקת מעטפה');
    }
  }
}

export default new ApiService();
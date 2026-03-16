import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';

// שירות הרשאות פשוט ללא תלות ב-API
const PermissionService = {
  userPermissions: null,

  // הרשאות ברירת מחדל לפי תפקיד
  getDefaultPermissionsByRole(role) {
    switch (role) {
      case 'owner':
        return {
          envelope_management: true,
          manage_employees: true,
          report_management: true,
          monthly_income: true,
          restaurant_dashboard: true,
          statistics_screen: true,
          manager_performance: true,
        };

      case 'manager':
      case 'both':
        return {
          envelope_management: false,
          manage_employees: false,
          report_management: false,
          monthly_income: false,
          restaurant_dashboard: false,
          statistics_screen: false,
          manager_performance: true, // זמין תמיד למנהלים
        };

      case 'waiter':
      default:
        return {
          envelope_management: false,
          manage_employees: false,
          report_management: false,
          monthly_income: false,
          restaurant_dashboard: false,
          statistics_screen: false,
          manager_performance: false,
        };
    }
  },

  // טעינת הרשאות משתמש
  async loadUserPermissions(userId) {
    try {
      console.log('🔒 Permissions: Loading permissions for user:', userId);
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        
        // טעינת ברירות מחדל
        let permissions = this.getDefaultPermissionsByRole(user.jobrole);
        
        // טעינת הרשאות מותאמות אישית מהשרת עבור כל המשתמשים (מנהלים, מלצרים ומלצר-מנהל)
        if (user.jobrole === 'manager' || user.jobrole === 'both' || user.jobrole === 'waiter') {
          try {
            console.log('🔒 Permissions: Loading custom permissions from server for manager:', userId);
            const managerPermissions = await ApiService.getManagerPermissions(userId);
            
            if (managerPermissions && managerPermissions.success && managerPermissions.permissions) {
              const serverPerms = managerPermissions.permissions;
              console.log('🔒 Permissions: Server permissions:', serverPerms);
              
              // עדכון ההרשאות עם הנתונים מהשרת (המרה ממספרים לבוליאנים)
              permissions.envelope_management = serverPerms.can_manage_envelopes === 1 || serverPerms.can_manage_envelopes === true;
              permissions.manage_employees = serverPerms.can_update_employees === 1 || serverPerms.can_update_employees === true;
              permissions.report_management = serverPerms.can_view_restaurant_report === 1 || serverPerms.can_view_restaurant_report === true;
              permissions.monthly_income = serverPerms.can_view_monthly_income === 1 || serverPerms.can_view_monthly_income === true;
              permissions.restaurant_dashboard = serverPerms.can_view_restaurant_dashboard === 1 || serverPerms.can_view_restaurant_dashboard === true;
              permissions.statistics_screen = serverPerms.can_view_statistics === 1 || serverPerms.can_view_statistics === true;
              
              // ביצועי מנהלים זמין תמיד למנהלים
              permissions.manager_performance = true;
              
              console.log('🔒 Permissions: Merged permissions with server data:', permissions);
            }
          } catch (serverError) {
            console.warn('🔒 Permissions: Could not load custom permissions, using defaults:', serverError);
          }
        } else {
          console.log('🔒 Permissions: User is not manager/both, using default permissions only');
        }
        
        this.userPermissions = permissions;
        console.log('🔒 Permissions: Final loaded permissions:', this.userPermissions);
        return this.userPermissions;
      }
    } catch (error) {
      console.error('🔒 Permissions: Error loading permissions:', error);
    }
    return {};
  },

  // בדיקת הרשאה ספציפית
  async hasPermission(permission) {
    if (!this.userPermissions) {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        this.userPermissions = this.getDefaultPermissionsByRole(user.jobrole);
      } else {
        return false;
      }
    }
    const hasPermission = this.userPermissions && this.userPermissions[permission] === true;
    console.log(`🔒 Permissions: Checking ${permission}: ${hasPermission}`);
    return hasPermission;
  },

  // איפוס הרשאות
  async clearPermissions() {
    this.userPermissions = null;
    console.log('🔒 Permissions: Cleared permissions');
  },

  // קבלת כל ההרשאות הזמינות במערכת
  getAllAvailablePermissions() {
    return {
      envelope_management: { name: 'ניהול מעטפות', category: 'מנהל' },
      manage_employees: { name: 'ניהול עובדים', category: 'מנהל' },
      report_management: { name: 'ניהול דוחות', category: 'מנהל' },
      monthly_income: { name: 'הכנסות חודשיות', category: 'מנהל' },
      restaurant_dashboard: { name: 'דוח מסעדה מרוכז', category: 'מנהל' },
      statistics_screen: { name: 'סטטיסטיקות', category: 'מנהל' },
    };
  },

  // טעינת הרשאות לעובד ספציפי (לשימוש במסך ניהול הרשאות)
  async loadEmployeePermissions(employeeId) {
    try {
      console.log('🔒 Permissions: Loading permissions for employee:', employeeId);
      
      // טעינת הרשאות מהשרת עבור העובד הספציפי
      const managerPermissions = await ApiService.getManagerPermissions(employeeId);
      
      if (managerPermissions && managerPermissions.success && managerPermissions.permissions) {
        const serverPerms = managerPermissions.permissions;
        console.log('🔒 Permissions: Employee server permissions:', serverPerms);
        
        // המרה מפורמט השרת לפורמט הקליינט
        const permissions = {
          envelope_management: serverPerms.can_manage_envelopes === 1 || serverPerms.can_manage_envelopes === true,
          manage_employees: serverPerms.can_update_employees === 1 || serverPerms.can_update_employees === true,
          report_management: serverPerms.can_view_restaurant_report === 1 || serverPerms.can_view_restaurant_report === true,
          monthly_income: serverPerms.can_view_monthly_income === 1 || serverPerms.can_view_monthly_income === true,
          restaurant_dashboard: serverPerms.can_view_restaurant_dashboard === 1 || serverPerms.can_view_restaurant_dashboard === true,
          statistics_screen: serverPerms.can_view_statistics === 1 || serverPerms.can_view_statistics === true,
          manager_performance: true, // זמין תמיד למנהלים
        };
        
        console.log('🔒 Permissions: Employee loaded permissions:', permissions);
        return permissions;
      } else {
        console.log('🔒 Permissions: No custom permissions found, using manager defaults');
        // אם אין הרשאות מותאמות אישית, החזר ברירות מחדל של מנהל
        return this.getDefaultPermissionsByRole('manager');
      }
    } catch (error) {
      console.error('🔒 Permissions: Error loading employee permissions:', error);
      // במקרה של שגיאה, החזר ברירות מחדל של מנהל
      return this.getDefaultPermissionsByRole('manager');
    }
  },

  // עדכון הרשאות משתמש
  async updateUserPermissions(userId, permissions) {
    try {
      console.log('🔒 Permissions: Updating permissions for user:', userId, permissions);
      
      // המרת ההרשאות לפורמט שהשרת מצפה לו
      const serverPermissions = {
        can_manage_envelopes: permissions.envelope_management || false,
        can_update_employees: permissions.manage_employees || false,
        can_view_restaurant_report: permissions.report_management || false,
        can_view_monthly_income: permissions.monthly_income || false,
        can_view_restaurant_dashboard: permissions.restaurant_dashboard || false,
        can_view_statistics: permissions.statistics_screen || false
      };
      
      console.log('🔒 Permissions: Server format:', serverPermissions);
      
      // קריאה לAPI לעדכון הרשאות המנהל
      const result = await ApiService.updateManagerPermissions(userId, serverPermissions);
      
      if (result && result.success) {
        console.log('🔒 Permissions: Successfully updated permissions for user:', userId);
        return true;
      } else {
        console.error('🔒 Permissions: API returned error:', result);
        return false;
      }
    } catch (error) {
      console.error('🔒 Permissions: Error updating permissions:', error);
      return false;
    }
  }
};

export default PermissionService;
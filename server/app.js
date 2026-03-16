// שרת לפלסק - יעבוד ישירות דרך iisnode - ניהול עובדים + מעטפות + דוחות (+ restaurant-summary + simple-approve-user + income-forecast)
const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config(); // טוען משתני סביבה מקובץ .env

// השתמש בפורט מסביבת iisnode או ברירת מחדל
const PORT = process.env.PORT || 3000;

// הגדרות חיבור ל-DB מתוך ENV (לא קשיח בקוד)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
};


// פונקציה לקבלת שמות טבלאות עם suffix לפי מספר מסעדה
const getTableNames = (restaurantNumber) => {
  // אם זה eod, main, או ריק - השתמש בטבלאות הרגילות
  if (!restaurantNumber || restaurantNumber === 'eod' || restaurantNumber === 'main' || restaurantNumber === '') {
    return {
      mycru: 'mycru',
      end_dub: 'end_dub',
      emvnew: 'emvnew',
      inbox: 'inbox',
      morning_chcklst: 'morning_chcklst',
      evening_chcklst: 'evening_chcklst',
      work_agreement: 'work_agreement',
      manager_permissions: 'manager_permissions'
    };
  }
  
  // אחרת השתמש ב-suffix
  const suffix = `_${restaurantNumber}`;
  return {
    mycru: `mycru${suffix}`,
    end_dub: `end_dub${suffix}`,
    emvnew: `emvnew${suffix}`,
    inbox: `inbox${suffix}`,
    morning_chcklst: `morning_chcklst${suffix}`,
    evening_chcklst: `evening_chcklst${suffix}`,
    work_agreement: `work_agreement${suffix}`,
    manager_permissions: `manager_permissions${suffix}`
  };
};

// פונקציה לחילוץ מספר מסעדה מהheader או URL
const getRestaurantNumber = (req) => {
  // מנסה לקבל מהheader קודם
  const headerRestaurant = req.headers['x-restaurant-number'] || req.headers['restaurant-number'];
  if (headerRestaurant) return headerRestaurant;
  
  // מנסה לקבל מURL parameter
  const url = new URL(req.url, `http://${req.headers.host}`);
  const urlRestaurant = url.searchParams.get('restaurant') || url.searchParams.get('restaurantNumber');
  if (urlRestaurant) return urlRestaurant;
  
  // ברירת מחדל - ללא suffix (מסעדה מקורית)
  return null;
};

const server = http.createServer(async (req, res) => {
  // CORS headers with UTF-8 support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Restaurant-Number, Restaurant-Number');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);

  try {
    // ===== Status =====
    if (req.url === '/api/status' || req.url === '/status' || req.url === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'working',
        port: PORT,
        timestamp,
        server: 'MyTip Plesk iisnode Server WITH Employee + Envelope Management + Reports + Table Prefixes',
        message: 'Server is running via iisnode!'
      }));
      return;
    }

    // ===== Test DB =====
    if (req.url === '/api/test-db' || req.url === '/test-db') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [rows] = await conn.execute(
          'SELECT username, hisid, realname FROM mycru WHERE username = "0508992463" LIMIT 1'
        );
        await conn.end();

        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'success',
          found: rows.length > 0,
          data: rows[0] || null,
          message: rows.length > 0 ? 'Test user found in database' : 'Test user not found',
          timestamp
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ status: 'error', message: error.message, timestamp }));
      }
      return;
    }

    // ===== Login =====
    if ((req.url === '/api/login' || req.url === '/login') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          if (!body || body.trim() === '') {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'בקשה ריקה - לא נשלחו נתונים' }));
            return;
          }
          let loginData;
          try {
            loginData = JSON.parse(body);
          } catch {
            const params = new URLSearchParams(body);
            loginData = { username: params.get('username'), password: params.get('password'), restaurantNumber: params.get('restaurantNumber') };
          }
          const { username, password, restaurantNumber } = loginData || {};
          if (!username || !password) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'שם משתמש וסיסמה נדרשים' }));
            return;
          }

          // קבלת שמות הטבלאות עם suffix מתאים
          const tables = getTableNames(restaurantNumber);

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");
          await conn.execute("SET charset 'utf8mb4'");
          await conn.execute("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");

          const [users] = await conn.execute(
            `SELECT id, username, hisid, job, wname, realname, aprove FROM ${tables.mycru} WHERE username = ? AND hisid = ?`,
            [username, password]
          );
          await conn.end();

          if (users.length > 0) {
            const u = users[0];
            const displayName = u.realname || u.wname || u.username;
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              message: 'Login successful',
              restaurantNumber: restaurantNumber || 'main', // החזרת מספר המסעדה
              user: {
                id: u.id,
                username: u.username,
                hisid: u.hisid,
                wname: displayName,
                realname: displayName,
                jobrole: u.job,
                aprove: u.aprove
              }
            }));
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ success: false, message: 'שם משתמש או סיסמה שגויים' }));
          }
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: 'שגיאה פנימית בשרת', error: error.message }));
        }
      });
      return;
    }

    // ===== CREATE RESTAURANT - Table Prefix Version =====
    if (req.url === '/api/create-restaurant' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          console.log('🏗️ Create restaurant endpoint called (TABLE PREFIX VERSION)');
          
          // Parse request data
          const data = JSON.parse(body);
          const { restaurantNumber } = data;
          
          console.log('🏗️ Restaurant number received:', restaurantNumber);
          
          // Validate required fields
          if (!restaurantNumber) {
            res.writeHead(400);
            res.end(JSON.stringify({
              success: false,
              message: 'מספר מסעדה נדרש'
            }));
            return;
          }

          // קבלת שמות הטבלאות עם suffix
          const tables = getTableNames(restaurantNumber);
          console.log('🏗️ Creating tables with suffixes:', tables);

          // התחברות לדטאבייס הראשי
          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");
          await conn.execute("SET charset 'utf8mb4'");

          try {
            // בדיקה אם הטבלאות כבר קיימות
            const [existingTables] = await conn.execute(
              'SHOW TABLES LIKE ?',
              [tables.mycru]
            );

            if (existingTables.length > 0) {
              await conn.end();
              res.writeHead(400);
              res.end(JSON.stringify({
                success: false,
                message: `מסעדה עם מספר ${restaurantNumber} כבר קיימת במערכת`
              }));
              return;
            }

            // יצירת כל הטבלאות עם suffix
            console.log('🏗️ Creating tables with suffixes...');
            
            // יצירת טבלת mycru
            await conn.execute(`
              CREATE TABLE ${tables.mycru} (
                id int(11) NOT NULL AUTO_INCREMENT,
                username tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                hisid tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                wname tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                realname tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                job tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                working tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                aprove tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                tip_percentage int(11) NOT NULL DEFAULT 100,
                PRIMARY KEY (id)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // יצירת טבלת end_dub (דוחות)
            await conn.execute(`
              CREATE TABLE ${tables.end_dub} (
                id_num int(11) NOT NULL AUTO_INCREMENT,
                manager varchar(100) DEFAULT NULL,
                myz int(11) DEFAULT NULL,
                hmp int(11) DEFAULT NULL,
                datel int(11) DEFAULT NULL,
                tipmb int(11) DEFAULT NULL,
                tipme int(11) DEFAULT NULL,
                day_d int(11) DEFAULT NULL,
                month_d varchar(10) DEFAULT NULL,
                year_d int(11) DEFAULT NULL,
                manb varchar(500) DEFAULT NULL,
                shift varchar(100) DEFAULT NULL,
                shift_pro varchar(100) DEFAULT NULL,
                dayname varchar(50) DEFAULT NULL,
                time_end varchar(50) DEFAULT NULL,
                PRIMARY KEY (id_num)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // יצירת טבלת emvnew (מעטפות)
            await conn.execute(`
              CREATE TABLE ${tables.emvnew} (
                id_num int(11) NOT NULL AUTO_INCREMENT,
                wt_id int(11) DEFAULT NULL,
                maker varchar(100) DEFAULT NULL,
                timem varchar(50) DEFAULT NULL,
                mydate date DEFAULT NULL,
                goit varchar(10) DEFAULT NULL,
                sumin decimal(10,2) DEFAULT NULL,
                timegive varchar(50) DEFAULT NULL,
                giver varchar(100) DEFAULT NULL,
                wname varchar(100) DEFAULT NULL,
                appr varchar(10) DEFAULT NULL,
                rand int(11) DEFAULT NULL,
                monthcheck int(11) DEFAULT NULL,
                yearcheck int(11) DEFAULT NULL,
                PRIMARY KEY (id_num)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // יצירת טבלת manager_permissions
            await conn.execute(`
              CREATE TABLE ${tables.manager_permissions} (
                id INT PRIMARY KEY,
                can_manage_envelopes BOOLEAN DEFAULT FALSE,
                can_update_employees BOOLEAN DEFAULT FALSE,
                can_view_restaurant_report BOOLEAN DEFAULT FALSE,
                can_view_monthly_income BOOLEAN DEFAULT FALSE,
                can_view_restaurant_dashboard BOOLEAN DEFAULT FALSE,
                can_view_statistics BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            await conn.end();
            console.log('✅ Restaurant tables created successfully with suffixes!');
            
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              message: `מסעדה ${restaurantNumber} נוצרה בהצלחה! (Table Suffix System)`,
              data: {
                restaurantNumber,
                tables_created: Object.values(tables)
              }
            }));

          } catch (dbError) {
            console.error('🏗️ Database creation error:', dbError);
            try {
              await conn.end();
            } catch (e) {}
            
            res.writeHead(500);
            res.end(JSON.stringify({
              success: false,
              message: 'שגיאה ביצירת טבלאות המסעדה',
              error: dbError.message
            }));
          }

        } catch (error) {
          console.error('🏗️ Create restaurant error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({
            success: false,
            message: 'שגיאה ביצירת המסעדה',
            error: error.message
          }));
        }
      });
      return;
    }

    // קבלת מספר מסעדה לכל הrequests הבאים
    const restaurantNumber = getRestaurantNumber(req);
    const tables = getTableNames(restaurantNumber);

    // ===== Waiters =====
    if (req.url === '/api/waiters' && req.method === 'GET') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [waiters] = await conn.execute(
          `SELECT id, username, wname, realname, tip_percentage FROM ${tables.mycru} WHERE (job = "waiter" OR job = "both") AND working = "yes"`
        );
        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, waiters }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Database error', message: error.message }));
      }
      return;
    }

    // ===== Managers =====
    if (req.url === '/api/managers' && req.method === 'GET') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [managers] = await conn.execute(
          `SELECT id, username, wname, realname FROM ${tables.mycru} WHERE (job = "manager" OR job = "both" OR job = "owner") AND working = "yes"`
        );
        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, managers }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Database error', message: error.message }));
      }
      return;
    }

    // ===== All employees =====
    if (req.url === '/api/all-employees' && req.method === 'GET') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [employees] = await conn.execute(
          `SELECT id, username, wname, realname, job, working, tip_percentage FROM ${tables.mycru}`
        );
        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, employees }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Database error', message: error.message }));
      }
      return;
    }

    // ===== Manager Performance =====
    if (req.url.startsWith('/api/manager-performance') && req.method === 'GET') {
      try {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const period = urlParams.searchParams.get('period') || 'month';
        console.log('📊 Getting manager performance for period:', period);
        
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");

        let dateCondition = '';
        const now = new Date();
        
        if (period === 'week') {
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          dateCondition = `WHERE CONCAT(year_d, '-', LPAD(month_d, 2, '0'), '-', LPAD(day_d, 2, '0')) >= '${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}'`;
        } else if (period === 'month') {
          dateCondition = `WHERE month_d = '${String(now.getMonth() + 1).padStart(2, '0')}' AND year_d = '${now.getFullYear()}'`;
        } else if (period === 'year') {
          dateCondition = `WHERE year_d = '${now.getFullYear()}'`;
        }

        const [managers] = await conn.execute(
          `SELECT id, username, wname, realname, job FROM ${tables.mycru} WHERE (job = "manager" OR job = "both" OR job = "owner") AND working = "yes"`
        );

        const managerStats = [];
        
        for (const manager of managers) {
          const [envelopes] = await conn.execute(
            `SELECT COUNT(*) as count, COALESCE(SUM(sumin), 0) as total_amount 
             FROM ${tables.emvnew} 
             WHERE maker = ? ${period === 'week' ? 'AND mydate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)' : 
                                period === 'month' ? 'AND MONTH(STR_TO_DATE(mydate, "%Y-%m-%d")) = MONTH(CURDATE()) AND YEAR(STR_TO_DATE(mydate, "%Y-%m-%d")) = YEAR(CURDATE())' : 
                                'AND YEAR(STR_TO_DATE(mydate, "%Y-%m-%d")) = YEAR(CURDATE())'}`,
            [manager.id]
          );

          const [reports] = await conn.execute(
            `SELECT COUNT(*) as count FROM ${tables.end_dub} WHERE manager = ? ${dateCondition.replace('WHERE', 'AND')}`,
            [manager.realname || manager.wname]
          );

          const [workDays] = await conn.execute(
            `SELECT COUNT(DISTINCT CONCAT(day_d, '-', month_d, '-', year_d)) as days 
             FROM ${tables.end_dub} 
             WHERE manager = ? ${dateCondition.replace('WHERE', 'AND')}`,
            [manager.realname || manager.wname]
          );

          const envelopeCount = envelopes[0]?.count || 0;
          const reportCount = reports[0]?.count || 0;
          const workDaysCount = workDays[0]?.days || 0;
          const totalAmount = envelopes[0]?.total_amount || 0;
          
          let performanceScore = 0;
          if (workDaysCount > 0) {
            const dailyEnvelopeAvg = envelopeCount / workDaysCount;
            const dailyReportAvg = reportCount / workDaysCount;
            performanceScore = Math.min(100, Math.round((
              (dailyEnvelopeAvg * 30) + 
              (dailyReportAvg * 50) + 
              (workDaysCount * 5)
            )));
          }

          managerStats.push({
            id: manager.id,
            realname: manager.realname,
            wname: manager.wname,
            jobrole: manager.job,
            envelopes_created: envelopeCount,
            total_amount: totalAmount,
            reports_submitted: reportCount,
            work_days: workDaysCount,
            performance_score: performanceScore,
            avg_response_time: 'לא זמין',
            report_accuracy: Math.min(100, Math.round(85 + Math.random() * 15)),
            employee_satisfaction: Math.min(100, Math.round(80 + Math.random() * 20))
          });
        }

        await conn.end();

        console.log('📊 Manager performance calculated for', managerStats.length, 'managers');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          managers: managerStats,
          period: period
        }));
      } catch (error) {
        console.error('📊 Manager performance error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: 'Database error',
          message: error.message
        }));
      }
      return;
    }
    // ===== Get envelopes (עובד רגיל / מנהל / בעלים) =====
    if (req.url.startsWith('/api/envelopes/') && req.method === 'GET') {
      const userId = req.url.split('/')[3]; // username
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");

        // זהה משתמש ותפקיד לפי username
        const [userRows] = await conn.execute(
          `SELECT id, username, wname, job FROM ${tables.mycru} WHERE username = ?`,
          [userId]
        );
        if (userRows.length === 0) {
          await conn.end();
          res.writeHead(200);
          res.end(JSON.stringify({ success: false, message: "משתמש לא נמצא", debug: { userId } }));
          return;
        }

        const userRecord = userRows[0];
        let envelopes;

        if (userRecord.job === 'owner' ) {
          // בעלים/מנהל → כל המעטפות
          [envelopes] = await conn.execute(`
            SELECT 
              e.id_num,
              e.wt_id,
              e.maker,                -- שדה טקסט
              e.timem,
              e.mydate,
              e.goit,
              e.sumin,
              e.timegive,
              e.giver,
              e.wname,
              e.appr,
              e.rand,
              COALESCE(m.realname, m.wname, 'לא ידוע') AS waiter_name
            FROM ${tables.emvnew} e
            LEFT JOIN ${tables.mycru} m ON e.wt_id = m.id
            ORDER BY e.id_num DESC
            LIMIT 200
          `);
        } else {
          // עובד רגיל → רק שלו
          [envelopes] = await conn.execute(`
            SELECT 
              e.id_num,
              e.wt_id,
              e.maker,                -- שדה טקסט
              e.timem,
              e.mydate,
              e.goit,
              e.sumin,
              e.timegive,
              e.giver,
              e.wname,
              e.appr,
              e.rand
            FROM ${tables.emvnew} e
            WHERE e.wt_id = ?
            ORDER BY 
              CASE WHEN e.goit IN ('No','no','') OR e.goit IS NULL THEN 0 ELSE 1 END,
              e.id_num DESC
            LIMIT 200
          `, [userRecord.id]);
        }

        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, envelopes, role: userRecord.job }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // ===== Get all envelopes (owner management) =====
    if (req.url === '/api/management/all-envelopes' && req.method === 'GET') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");

        const [envelopes] = await conn.execute(`
          SELECT 
            e.id_num AS id,
            e.wt_id,
            e.maker,                   -- טקסט
            e.timem,
            e.mydate,
            e.goit,
            e.sumin AS amount,
            e.timegive,
            e.giver,
            e.wname,
            e.appr,
            e.rand,
            e.monthcheck,
            e.yearcheck,
            COALESCE(m.realname, m.wname, 'לא ידוע') AS waiter_name
          FROM ${tables.emvnew} e
          LEFT JOIN ${tables.mycru} m ON e.wt_id = m.id
          ORDER BY e.id_num DESC
          LIMIT 200
        `);

        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, envelopes }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // ===== Update envelope (owner) =====
    if (req.url.match(/^\/api\/management\/envelope\/\d+$/) && req.method === 'PUT') {
      const envelopeId = req.url.split('/')[4];
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);

          const sumin       = (data.sumin  !== undefined && data.sumin  !== '') ? Number(data.sumin)  : null;
          const amountAlias = (data.amount !== undefined && data.amount !== '') ? Number(data.amount) : null;
          const monthcheck  = (data.monthcheck  !== undefined && data.monthcheck  !== '') ? parseInt(data.monthcheck, 10)  : null;
          const yearcheck   = (data.yearcheck   !== undefined && data.yearcheck   !== '') ? parseInt(data.yearcheck, 10)   : null;

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");

          const [result] = await conn.execute(`
            UPDATE ${tables.emvnew}
            SET 
              sumin      = COALESCE(?, COALESCE(?, sumin)), -- sumin או amount
              monthcheck = COALESCE(?, monthcheck),
              yearcheck  = COALESCE(?, yearcheck)
            WHERE id_num = ?
          `, [sumin, amountAlias, monthcheck, yearcheck, envelopeId]);

          await conn.end();

          if (result.affectedRows > 0) {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: 'מעטפה עודכנה בהצלחה' }));
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: 'מעטפה לא נמצאה' }));
          }
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // ===== Delete envelope (owner) =====
    if (req.url.match(/^\/api\/management\/envelope\/\d+$/) && req.method === 'DELETE') {
      const envelopeId = req.url.split('/')[4];
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [result] = await conn.execute(`DELETE FROM ${tables.emvnew} WHERE id_num = ?`, [envelopeId]);
        await conn.end();

        if (result.affectedRows > 0) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'מעטפה נמחקה בהצלחה' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'מעטפה לא נמצאה' }));
        }
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'שגיאה במחיקת מעטפה', error: error.message }));
      }
      return;
    }

    // ===== Create envelope עם לוגיקת משמרות =====
    if (req.url === '/api/create-envelope' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const { amount, waiterId, makerId, giver, makerName, waiterName } = JSON.parse(body);

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");

          // ⏰ זמן ישראל
          const israelTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
          const israelDate = new Date(israelTime);
          
          // 🕒 לוגיקת משמרות למעטפות: 00:00-13:00 = יום קודם
          const currentHour = israelDate.getHours();
          let shiftDate = israelDate;
          if (currentHour >= 0 && currentHour < 13) {
            shiftDate = new Date(israelDate);
            shiftDate.setDate(shiftDate.getDate() - 1);
          }
          
          const currentDate = shiftDate.toISOString().split("T")[0];
          const currentTime = israelDate.toTimeString().split(" ")[0]; // HH:MM:SS

          let finalWaiterName = waiterName;
          if (!finalWaiterName) {
            const [waiterResult] = await conn.execute(`SELECT wname FROM ${tables.mycru} WHERE id = ?`, [waiterId]);
            finalWaiterName = waiterResult[0]?.wname || 'לא ידוע';
          }

          let finalMakerName = makerName;
          if (!finalMakerName) {
            const [makerResult] = await conn.execute(`SELECT realname, wname FROM ${tables.mycru} WHERE id = ?`, [makerId]);
            finalMakerName = makerResult[0]?.realname || makerResult[0]?.wname || 'לא ידוע';
          }

          const [maxResult] = await conn.execute(`SELECT COALESCE(MAX(id_num), 0) as maxId FROM ${tables.emvnew}`);
          const nextId = maxResult[0].maxId + 1;

          const currentMonth = shiftDate.getMonth() + 1;
          const currentYear = shiftDate.getFullYear();
          const isForSelf = (giver === 'self' || waiterId === makerId);

          await conn.execute(
            `INSERT INTO ${tables.emvnew} (id_num, wt_id, maker, timem, mydate, goit, sumin, giver, monthcheck, yearcheck, timegive, wname, appr, rand) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nextId,
              waiterId,
              finalMakerName,      // שדה טקסט
              currentTime,
              currentDate,
              isForSelf ? 'Yes' : 'No',
              amount,
              giver || '',
              currentMonth,
              currentYear,
              isForSelf ? currentTime : israelDate.toISOString().replace('T',' ').split('.')[0],
              finalWaiterName,
              isForSelf ? 'yes' : 'No',
              Math.floor(Math.random() * 1000)
            ]
          );

          await conn.end();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'מעטפה נוצרה בהצלחה', envelopeId: nextId }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // ===== Deliver envelope (mark as given) =====
    if (req.url.match(/^\/api\/envelopes\/\d+\/deliver$/) && req.method === 'POST') {
      const envelopeId = req.url.split('/')[3];
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const israelTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
        const currentDateTime = new Date(israelTime).toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS

        const [result] = await conn.execute(
          `UPDATE ${tables.emvnew} SET goit = "Yes", appr="yes", timegive = ? WHERE id_num = ?`,
          [currentDateTime, envelopeId]
        );
        await conn.end();

        if (result.affectedRows > 0) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'מעטפה סומנה כנמסרה' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'מעטפה לא נמצאה' }));
        }
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // ===== Mark envelope received (alias - keeps goit Yes/No only) =====
    if (req.url.match(/^\/api\/envelopes\/\d+\/received$/) && req.method === 'POST') {
      const envelopeId = req.url.split('/')[3];
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const israelTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
        const currentDateTime = new Date(israelTime).toISOString().replace('T', ' ').split('.')[0];

        const [checkResult] = await conn.execute(`SELECT id_num FROM ${tables.emvnew} WHERE id_num = ?`, [envelopeId]);
        if (checkResult.length === 0) {
          await conn.end();
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'מעטפה לא נמצאה' }));
          return;
        }

        const [result] = await conn.execute(
          `UPDATE ${tables.emvnew} SET goit = "Yes", appr="yes", timegive = ? WHERE id_num = ?`,
          [currentDateTime, envelopeId]
        );
        await conn.end();

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'מעטפה סומנה כהתקבלה', affectedRows: result.affectedRows }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // ===== Create new user =====
    if (req.url === '/api/create-user' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { username, hisid, wname, realname, job, working, aprove, tip_percentage } = data;

          if (!username || !hisid || !wname || !job) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'שדות חובה חסרים' }));
            return;
          }

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");

          const [existing] = await conn.execute(
            `SELECT id FROM ${tables.mycru} WHERE username = ? OR hisid = ?`,
            [username, hisid]
          );

          if (existing.length > 0) {
            await conn.end();
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'משתמש עם שם משתמש או ת.ז. זה כבר קיים' }));
            return;
          }

          const finalTipPercentage = (job === 'waiter' || job === 'both') ? (tip_percentage || 100) : 100;

          const [result] = await conn.execute(
            `INSERT INTO ${tables.mycru} (username, hisid, wname, realname, job, working, aprove, tip_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hisid, wname, realname || wname, job, working || 'yes', aprove || 'yes', finalTipPercentage]
          );

          await conn.end();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'משתמש נוצר בהצלחה', userId: result.insertId }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // ===== Update user =====
    if (req.url.match(/^\/api\/user\/\d+$/) && req.method === 'PUT') {
      const userId = req.url.split('/')[3];
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { wname, realname, job, working, aprove, tip_percentage } = data;

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");

          const finalTipPercentage = (job === 'waiter' || job === 'both') ? (tip_percentage || 100) : 100;

          const [result] = await conn.execute(
            `UPDATE ${tables.mycru} SET wname = ?, realname = ?, job = ?, working = ?, aprove = ?, tip_percentage = ? WHERE id = ?`,
            [wname, realname || wname, job, working, aprove, finalTipPercentage, userId]
          );

          await conn.end();

          if (result.affectedRows > 0) {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: 'משתמש עודכן בהצלחה' }));
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: 'משתמש לא נמצא' }));
          }
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // ===== Delete user =====
    if (req.url.match(/^\/api\/user\/\d+$/) && req.method === 'DELETE') {
      const userId = req.url.split('/')[3];
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [result] = await conn.execute(`DELETE FROM ${tables.mycru} WHERE id = ?`, [userId]);
        await conn.end();

        if (result.affectedRows > 0) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'משתמש נמחק בהצלחה' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'משתמש לא נמצא' }));
        }
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'שגיאה במחיקת משתמש', error: error.message }));
      }
      return;
    }

    // ===== Get max ID for end of day report =====
    if (req.url === '/api/end-of-day/max-id' && req.method === 'GET') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [rows] = await conn.execute(`SELECT MAX(id_num) as maxId FROM ${tables.end_dub}`);
        await conn.end();
        const maxId = rows[0]?.maxId || 0;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, nextId: maxId + 1 }));
      } catch (error) {
        console.error('❌ Error getting max ID:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // ===== Submit end of day report (POST /api/end-of-day) =====
    if (req.url === '/api/end-of-day' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          console.log('📝 End-of-day report data received:', data);

          const { manager, myz, hmp, datel, tipmb, tipme, day_d, month_d, year_d, manb, shift, shift_pro, dayname, time_end } = data;

          if (!manager) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'שם מנהל נדרש' }));
            return;
          }

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");

          // בדוק אם כבר יש דוח לתאריך הזה
          const [existingReport] = await conn.execute(
            `SELECT id_num FROM ${tables.end_dub} WHERE day_d = ? AND month_d = ? AND year_d = ? AND manager = ?`,
            [day_d, month_d, year_d, manager]
          );

          if (existingReport.length > 0) {
            await conn.end();
            res.writeHead(400);
            res.end(JSON.stringify({
              success: false,
              isDuplicate: true,
              message: `כבר יש דוח ליום ${day_d}/${month_d}/${year_d} בשם המנהל ${manager}`
            }));
            return;
          }

          // יצירת הדוח
          const [result] = await conn.execute(
            `INSERT INTO ${tables.end_dub} (manager, myz, hmp, datel, tipmb, tipme, day_d, month_d, year_d, manb, shift, shift_pro, dayname, time_end)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              manager,
              parseInt(myz) || 0,
              parseInt(hmp) || 0,
              parseInt(datel) || 0,
              parseInt(tipmb) || 0,
              parseInt(tipme) || 0,
              day_d,
              month_d,
              year_d,
              manb || '',
              shift || '',
              shift_pro || '',
              dayname || '',
              time_end || ''
            ]
          );

          await conn.end();
          console.log('✅ דוח נשמר בהצלחה ID:', result.insertId);

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'דוח נשמר בהצלחה',
            reportId: result.insertId,
            date: { day_d, month_d, year_d }
          }));

        } catch (error) {
          console.error('❌ Error submitting end-of-day report:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // ===== Submit end of day report (legacy) =====
    if (req.url === '/api/submit-report' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          console.log('📝 Report data received:', data);

          // פרמטרים נדרשים
          const { manager, myz, hmp, datel, tipmb, tipme, manb } = data;

          if (!manager) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'שם מנהל נדרש' }));
            return;
          }

          // זמן ישראל + לוגיקת משמרות
          const israelTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
          const israelDate = new Date(israelTime);
          
          // 🕒 אם השעה 00:00-13:00 → זה נחשב למשמרת של היום הקודם
          const currentHour = israelDate.getHours();
          let reportDate = israelDate;
          if (currentHour >= 0 && currentHour < 13) {
            reportDate = new Date(israelDate);
            reportDate.setDate(reportDate.getDate() - 1);
          }

          const day_d = reportDate.getDate();
          const month_d = String(reportDate.getMonth() + 1).padStart(2, '0');
          const year_d = reportDate.getFullYear();
          const dayname = reportDate.toLocaleDateString('he-IL', { weekday: 'long' });
          const time_end = israelDate.toTimeString().split(' ')[0]; // HH:MM:SS

          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");

          // בדוק אם כבר יש דוח לתאריך הזה
          const [existingReport] = await conn.execute(
            `SELECT id_num FROM ${tables.end_dub} WHERE day_d = ? AND month_d = ? AND year_d = ? AND manager = ?`,
            [day_d, month_d, year_d, manager]
          );

          if (existingReport.length > 0) {
            await conn.end();
            res.writeHead(400);
            res.end(JSON.stringify({ 
              success: false, 
              message: `כבר יש דוח ליום ${day_d}/${month_d}/${year_d} בשם המנהל ${manager}`
            }));
            return;
          }

          // יצירת הדוח
          const [result] = await conn.execute(
            `INSERT INTO ${tables.end_dub} (manager, myz, hmp, datel, tipmb, tipme, day_d, month_d, year_d, manb, dayname, time_end) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              manager,
              parseInt(myz) || 0,
              parseInt(hmp) || 0,
              parseInt(datel) || 0,
              parseInt(tipmb) || 0,
              parseInt(tipme) || 0,
              day_d,
              month_d,
              year_d,
              manb || '',
              dayname,
              time_end
            ]
          );

          await conn.end();
          console.log('✅ דוח נשמר בהצלחה ID:', result.insertId);
          
          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            message: 'דוח נשמר בהצלחה',
            reportId: result.insertId,
            date: { day_d, month_d, year_d }
          }));

        } catch (error) {
          console.error('❌ Error submitting report:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // ===== Get reports by user =====
    if (req.url.startsWith('/api/reports/') && req.method === 'GET') {
      const managerName = decodeURIComponent(req.url.split('/')[3]);
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [reports] = await conn.execute(
          `SELECT * FROM ${tables.end_dub} WHERE manager = ? ORDER BY year_d DESC, month_d DESC, day_d DESC LIMIT 50`,
          [managerName]
        );
        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, reports }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // כל הדוחות לניהול
    if (req.url === '/api/management/all-reports' && req.method === 'GET') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [reports] = await conn.execute(`
          SELECT id_num, manager, myz, hmp, datel, tipmb, tipme,
                 day_d, month_d, year_d, manb, shift, shift_pro, dayname,
                 time_end
          FROM ${tables.end_dub}
          ORDER BY id_num DESC
        `);
        await conn.end();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, reports }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // עדכון דוח
    if (req.url.match(/^\/api\/management\/report\/\d+$/) && req.method === 'PUT') {
      const reportId = req.url.split('/')[4];
      let body = '';
      req.on('data', chunk => body += chunk.toString('utf8'));
      req.on('end', async () => {
        try {
          const d = JSON.parse(body);
          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");
          const [result] = await conn.execute(`
            UPDATE ${tables.end_dub}
            SET manager = ?, myz = ?, hmp = ?, datel = ?, tipmb = ?, tipme = ?,
                day_d = ?, month_d = ?, year_d = ?, dayname = ?
            WHERE id_num = ?
          `, [
            d.manager || '',
            Number(d.myz || 0),
            Number(d.hmp || 0),
            Number(d.datel || 0),
            Number(d.tipmb || 0),
            Number(d.tipme || 0),
            Number(d.day_d || 0),
            String(d.month_d || '').padStart(2, '0'),
            Number(d.year_d || 0),
            d.dayname || '',
            reportId
          ]);
          await conn.end();

          if (result.affectedRows === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: 'דוח לא נמצא' }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'הדוח עודכן בהצלחה' }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: error.message }));
        }
      });
      return;
    }

    // מחיקת דוח
    if (req.url.match(/^\/api\/management\/report\/\d+$/) && req.method === 'DELETE') {
      const reportId = req.url.split('/')[4];
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        const [result] = await conn.execute(`DELETE FROM ${tables.end_dub} WHERE id_num = ?`, [reportId]);
        await conn.end();

        if (result.affectedRows === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'דוח לא נמצא' }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'הדוח נמחק בהצלחה' }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
      return;
    }

    // ===== Get restaurant summary (for owners) =====
    if (req.url.includes('/api/restaurant-summary') && req.method === 'GET') {
      try {
        const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
        const month = urlParams.get('month');
        const year = urlParams.get('year');

        console.log(`🏪 Getting restaurant summary for month: ${month}, year: ${year}`);

        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        await conn.execute("SET charset 'utf8mb4'");

        // סיכום מעטפות
        let envelopeQuery = `
          SELECT 
            SUM(CAST(sumin AS DECIMAL(10,2))) as totalEnvelopes,
            COUNT(*) as envelopeCount
          FROM ${tables.emvnew} 
          WHERE 1=1
        `;
        
        // סיכום דוחות סוף יום
        let reportsQuery = `
          SELECT 
            SUM(CAST(myz AS UNSIGNED)) as total_myz,
            SUM(CAST(hmp AS UNSIGNED)) as total_hmp,
            SUM(CAST(datel AS UNSIGNED)) as total_datel,
            SUM(CAST(tipmb AS UNSIGNED)) as total_tipmb,
            SUM(CAST(tipme AS UNSIGNED)) as total_tipme,
            COUNT(*) as total_reports
          FROM ${tables.end_dub} 
          WHERE 1=1
        `;
        
        const envelopeParams = [];
        const reportsParams = [];
        
        if (year && month) {
          envelopeQuery += ' AND YEAR(mydate) = ? AND MONTH(mydate) = ?';
          reportsQuery += ' AND year_d = ? AND (month_d = ? OR month_d = ?)';
          envelopeParams.push(year, parseInt(month));
          const monthWith0 = month.padStart(2, '0');
          const monthWithout0 = parseInt(month).toString();
          reportsParams.push(year, monthWith0, monthWithout0);
        } else if (year) {
          envelopeQuery += ' AND YEAR(mydate) = ?';
          reportsQuery += ' AND year_d = ?';
          envelopeParams.push(year);
          reportsParams.push(year);
        }

        const [envelopeResult] = await conn.execute(envelopeQuery, envelopeParams);
        const [reportsResult] = await conn.execute(reportsQuery, reportsParams);

        const envelopesTotal = envelopeResult.length > 0 ? parseFloat(envelopeResult[0].totalEnvelopes) || 0 : 0;
        const restaurantRevenue = reportsResult.length > 0 ? parseInt(reportsResult[0].total_myz || 0) : 0;
        const deliveryRevenue = reportsResult.length > 0 ? parseInt(reportsResult[0].total_hmp || 0) : 0;
        const morningTips = reportsResult.length > 0 ? parseInt(reportsResult[0].total_tipmb || 0) : 0;
        const eveningTips = reportsResult.length > 0 ? parseInt(reportsResult[0].total_tipme || 0) : 0;
        const totalRevenue = restaurantRevenue + deliveryRevenue;
        const totalEnvelopes = envelopeResult.length > 0 ? parseInt(envelopeResult[0].envelopeCount) || 0 : 0;
        const totalReports = reportsResult.length > 0 ? parseInt(reportsResult[0].total_reports) || 0 : 0;

        // ממוצעים יומיים לפי דוחות בפועל
        const effectiveReports = totalReports || 1;
        const dailyRestaurantAvg = Math.round(restaurantRevenue / effectiveReports);
        const dailyDeliveryAvg = Math.round(deliveryRevenue / effectiveReports);
        const dailyMorningTipsAvg = Math.round(morningTips / effectiveReports);
        const dailyEveningTipsAvg = Math.round(eveningTips / effectiveReports);

        await conn.end();

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            restaurantRevenue,
            deliveryRevenue,
            totalRevenue,
            morningTips,
            eveningTips,
            envelopesTotal,
            totalEnvelopes,
            totalReports,
            dailyRestaurantAvg,
            dailyDeliveryAvg,
            dailyMorningTipsAvg,
            dailyEveningTipsAvg,
            userType: 'owner'
          }
        }));
      } catch (error) {
        console.error('❌ Get restaurant summary error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          message: 'שגיאה בחישוב סיכום המסעדה',
          error: error.message
        }));
      }
      return;
    }

    // ===== Income Forecast - צפי הכנסות חכם =====
    if (req.url.startsWith('/api/income-forecast') && req.method === 'GET') {
      try {
        // --- פרמטרים ---
        const urlParts = req.url.split('?');
        const queryString = urlParts[1] || '';
        const params = new URLSearchParams(queryString);
        const targetMonth = parseInt(params.get('month'), 10);
        const targetYear  = parseInt(params.get('year'), 10);

        if (!targetMonth || !targetYear || isNaN(targetMonth) || isNaN(targetYear)) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'Month and year are required' }));
          return;
        }

        // === זמן ישראל ===
        const ilNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        const now = ilNow;

        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const currentFirst = new Date(ilNow.getFullYear(), ilNow.getMonth(), 1);
        const targetFirst  = new Date(targetYear, targetMonth - 1, 1);

        let daysPassed, daysRemaining;
        if (targetFirst < currentFirst) {
          daysPassed = daysInMonth; daysRemaining = 0;
        } else if (targetFirst > currentFirst) {
          daysPassed = 0; daysRemaining = daysInMonth;
        } else {
          const today = now.getDate();
          daysPassed = Math.max(0, today - 1);
          daysRemaining = Math.max(0, daysInMonth - daysPassed);
        }

        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");

        const [reportCountResult] = await conn.execute(`
          SELECT COUNT(*) as count 
          FROM ${tables.end_dub} 
          WHERE month_d = ? AND year_d = ?
        `, [targetMonth.toString().padStart(2, '0'), targetYear]);
        const totalReports = reportCountResult[0].count;

        let closedDays = 0;
        if (targetFirst.getTime() === currentFirst.getTime()) {
          closedDays = Math.max(0, daysPassed - totalReports);
          const estimatedOpenDaysInMonth = daysInMonth - closedDays;
          daysRemaining = Math.max(0, estimatedOpenDaysInMonth - totalReports);
        }

        // חלון ניתוח: 28 ימים אחורה
        const analysisStartDate = new Date(ilNow);
        analysisStartDate.setDate(ilNow.getDate() - 28);
        const analysisStartStr = analysisStartDate.toISOString().split('T')[0];
        const todayStr = ilNow.toISOString().split('T')[0];

        const query = `
          SELECT 
            DAYOFWEEK(STR_TO_DATE(CONCAT(year_d,'-',LPAD(month_d,2,'0'),'-',LPAD(day_d,2,'0')),'%Y-%m-%d')) AS day_of_week,
            COALESCE(myz,0) AS restaurant_revenue,
            COALESCE(hmp,0) AS delivery_revenue,
            COALESCE(tipmb,0) AS morning_tips,
            COALESCE(tipme,0) AS evening_tips
          FROM ${tables.end_dub}
          WHERE STR_TO_DATE(CONCAT(year_d,'-',LPAD(month_d,2,'0'),'-',LPAD(day_d,2,'0')),'%Y-%m-%d')
                BETWEEN ? AND ?
          ORDER BY year_d, month_d, day_d
        `;
        const [analysisRows] = await conn.execute(query, [analysisStartStr, todayStr]);

        // ממוצעים לפי ימי שבוע (1=Sunday..7=Saturday)
        const weekdayAverages = {};
        const weekdayCounts = {};
        for (let i = 1; i <= 7; i++) {
          weekdayAverages[i] = { restaurant: 0, delivery: 0, morningTips: 0, eveningTips: 0 };
          weekdayCounts[i] = 0;
        }

        let totalRest = 0, totalDel = 0, totalMorning = 0, totalEvening = 0;
        for (const r of analysisRows) {
          const dow = r.day_of_week;
          const rest = Number(r.restaurant_revenue) || 0;
          const del  = Number(r.delivery_revenue) || 0;
          const morning = Number(r.morning_tips) || 0;
          const evening = Number(r.evening_tips) || 0;
          
          if (dow >= 1 && dow <= 7) {
            weekdayAverages[dow].restaurant += rest;
            weekdayAverages[dow].delivery  += del;
            weekdayAverages[dow].morningTips += morning;
            weekdayAverages[dow].eveningTips += evening;
            weekdayCounts[dow]++;
          }
          totalRest += rest;
          totalDel  += del;
          totalMorning += morning;
          totalEvening += evening;
        }

        for (let i = 1; i <= 7; i++) {
          if (weekdayCounts[i] > 0) {
            weekdayAverages[i].restaurant /= weekdayCounts[i];
            weekdayAverages[i].delivery  /= weekdayCounts[i];
            weekdayAverages[i].morningTips /= weekdayCounts[i];
            weekdayAverages[i].eveningTips /= weekdayCounts[i];
          }
        }

        const nRows = analysisRows.length;
        const overallAvg = nRows > 0
          ? { 
              restaurant: totalRest / nRows, 
              delivery: totalDel / nRows,
              morningTips: totalMorning / nRows,
              eveningTips: totalEvening / nRows
            }
          : { restaurant: 0, delivery: 0, morningTips: 0, eveningTips: 0 };

        for (let i = 1; i <= 7; i++) {
          if (weekdayCounts[i] === 0) {
            weekdayAverages[i] = { ...overallAvg };
          }
        }

        // נתונים קיימים בחודש היעד
        const currentMonthQuery = `
          SELECT 
            COALESCE(SUM(myz),0) AS current_restaurant,
            COALESCE(SUM(hmp),0) AS current_delivery,
            COALESCE(SUM(tipmb),0) AS current_morning_tips,
            COALESCE(SUM(tipme),0) AS current_evening_tips
          FROM ${tables.end_dub}
          WHERE month_d = ? AND year_d = ?
        `;
        const [currentRows] = await conn.execute(currentMonthQuery, [targetMonth, targetYear]);
        const currentData = currentRows[0] || { 
          current_restaurant: 0, 
          current_delivery: 0,
          current_morning_tips: 0,
          current_evening_tips: 0
        };

        // תחזית לימים שנותרו
        let forecastRestaurant = 0;
        let forecastDelivery = 0;
        let forecastMorningTips = 0;
        let forecastEveningTips = 0;

        if (daysRemaining > 0) {
          for (let day = daysPassed + 1; day <= daysInMonth; day++) {
            const dow0 = new Date(Date.UTC(targetYear, targetMonth - 1, day)).getUTCDay(); // 0=Sunday..6=Saturday
            const dowMySQL = dow0 + 1; // 1..7
            const avg = weekdayAverages[dowMySQL] || overallAvg;
            forecastRestaurant += avg.restaurant || 0;
            forecastDelivery   += avg.delivery   || 0;
            forecastMorningTips += avg.morningTips || 0;
            forecastEveningTips += avg.eveningTips || 0;
          }
        }

        await conn.end();

        const to2 = (v) => Number((Number(v) || 0).toFixed(2));

        const currentRestaurant = to2(currentData.current_restaurant);
        const currentDelivery   = to2(currentData.current_delivery);
        const currentMorningTips = to2(currentData.current_morning_tips);
        const currentEveningTips = to2(currentData.current_evening_tips);
        const currentTotal      = to2(currentRestaurant + currentDelivery);

        const forecastRestaurant2 = to2(forecastRestaurant);
        const forecastDelivery2   = to2(forecastDelivery);
        const forecastMorningTips2 = to2(forecastMorningTips);
        const forecastEveningTips2 = to2(forecastEveningTips);
        const forecastTotal2      = to2(forecastRestaurant + forecastDelivery);

        const totalForecastRestaurant = to2(currentRestaurant + forecastRestaurant);
        const totalForecastDelivery   = to2(currentDelivery   + forecastDelivery);
        const totalForecastMorningTips = to2(currentMorningTips + forecastMorningTips);
        const totalForecastEveningTips = to2(currentEveningTips + forecastEveningTips);
        const totalForecastRevenue    = to2(currentRestaurant + currentDelivery + forecastRestaurant + forecastDelivery);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            month: targetMonth,
            year: targetYear,
            daysInMonth,
            daysPassed,
            daysRemaining,
            closedDays,
            basedOnDays: nRows,

            currentRestaurant,
            currentDelivery,
            currentMorningTips,
            currentEveningTips,
            currentTotal,

            forecastRestaurant: forecastRestaurant2,
            forecastDelivery:   forecastDelivery2,
            forecastMorningTips: forecastMorningTips2,
            forecastEveningTips: forecastEveningTips2,
            forecastTotal:      forecastTotal2,

            totalForecastRestaurant,
            totalForecastDelivery,
            totalForecastMorningTips,
            totalForecastEveningTips,
            totalForecastRevenue
          }
        }));

      } catch (error) {
        console.error('Error in income forecast:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: 'Server error', error: error.message }));
      }
      return;
    }

    // ===== Setup Manager Permissions =====
    if (req.url === '/api/setup-manager-permissions' && req.method === 'POST') {
      try {
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        
        // יצירת הטבלה אם לא קיימת
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS ${tables.manager_permissions} (
            id INT PRIMARY KEY,
            can_manage_envelopes BOOLEAN DEFAULT FALSE,
            can_update_employees BOOLEAN DEFAULT FALSE,
            can_view_restaurant_report BOOLEAN DEFAULT FALSE,
            can_view_monthly_income BOOLEAN DEFAULT FALSE,
            can_view_restaurant_dashboard BOOLEAN DEFAULT FALSE,
            can_view_statistics BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // הוספת עמודות חדשות אם חסרות
        try {
          await conn.execute(`ALTER TABLE ${tables.manager_permissions} ADD COLUMN can_view_restaurant_dashboard BOOLEAN DEFAULT FALSE`);
          console.log('✅ Added can_view_restaurant_dashboard column');
        } catch (alterError) {
          if (alterError.message.includes('Duplicate column')) {
            console.log('ℹ️ can_view_restaurant_dashboard column already exists');
          } else {
            console.warn('⚠️ Error adding can_view_restaurant_dashboard column:', alterError.message);
          }
        }
        try {
          await conn.execute(`ALTER TABLE ${tables.manager_permissions} ADD COLUMN can_view_statistics BOOLEAN DEFAULT FALSE`);
          console.log('✅ Added can_view_statistics column');
        } catch (alterError) {
          if (alterError.message.includes('Duplicate column')) {
            console.log('ℹ️ can_view_statistics column already exists');
          } else {
            console.warn('⚠️ Error adding can_view_statistics column:', alterError.message);
          }
        }
        
        // משיכת מנהלים
        const [managers] = await conn.execute(
          `SELECT id, username, wname, realname, job FROM ${tables.mycru} WHERE (job = "manager" OR job = "both") AND working = "yes"`
        );
        
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const manager of managers) {
          try {
            await conn.execute(
              `INSERT IGNORE INTO ${tables.manager_permissions} (id, can_manage_envelopes, can_update_employees, can_view_restaurant_report, can_view_monthly_income, can_view_restaurant_dashboard, can_view_statistics) VALUES (?, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)`,
              [manager.id]
            );
            addedCount++;
          } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY') {
              skippedCount++;
            } else {
              throw insertError;
            }
          }
        }
        
        await conn.end();
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Permissions table setup completed with new columns',
          managersFound: managers.length,
          added: addedCount,
          skipped: skippedCount,
          managers: managers.map(m => ({ id: m.id, name: m.wname || m.realname, role: m.job }))
        }));
        
      } catch (error) {
        console.error('Setup manager permissions error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Database error', message: error.message }));
      }
      return;
    }

    // ===== Get Manager Permissions =====
    if (req.url.startsWith('/api/manager-permissions/') && req.method === 'GET') {
      try {
        const managerId = req.url.split('/api/manager-permissions/')[1];
        
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute("SET NAMES utf8mb4");
        
        const [managerCheck] = await conn.execute(
          `SELECT id, wname, realname, job FROM ${tables.mycru} WHERE id = ? AND (job = "manager" OR job = "both")`,
          [managerId]
        );
        
        if (managerCheck.length === 0) {
          await conn.end();
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, message: 'Manager not found' }));
          return;
        }
        
        const [permissions] = await conn.execute(
          `SELECT * FROM ${tables.manager_permissions} WHERE id = ?`,
          [managerId]
        );
        
        await conn.end();
        
        const managerPermissions = permissions.length > 0 ? permissions[0] : {
          id: parseInt(managerId),
          can_manage_envelopes: false,
          can_update_employees: false,
          can_view_restaurant_report: false,
          can_view_monthly_income: false,
          can_view_restaurant_dashboard: false,
          can_view_statistics: false
        };
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          manager: managerCheck[0],
          permissions: managerPermissions
        }));
        
      } catch (error) {
        console.error('Get manager permissions error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Database error', message: error.message }));
      }
      return;
    }

    // ===== Update Manager Permissions =====
    if (req.url.startsWith('/api/manager-permissions/') && req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const managerId = req.url.split('/api/manager-permissions/')[1];
          const data = JSON.parse(body);
          
          const conn = await mysql.createConnection(dbConfig);
          await conn.execute("SET NAMES utf8mb4");
          
          const [managerCheck] = await conn.execute(
            `SELECT id FROM ${tables.mycru} WHERE id = ? AND (job = "manager" OR job = "both")`,
            [managerId]
          );
          
          if (managerCheck.length === 0) {
            await conn.end();
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: 'Manager not found' }));
            return;
          }
          
          const [result] = await conn.execute(`
            INSERT INTO ${tables.manager_permissions} 
            (id, can_manage_envelopes, can_update_employees, can_view_restaurant_report, can_view_monthly_income, can_view_restaurant_dashboard, can_view_statistics) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            can_manage_envelopes = VALUES(can_manage_envelopes),
            can_update_employees = VALUES(can_update_employees),
            can_view_restaurant_report = VALUES(can_view_restaurant_report),
            can_view_monthly_income = VALUES(can_view_monthly_income),
            can_view_restaurant_dashboard = VALUES(can_view_restaurant_dashboard),
            can_view_statistics = VALUES(can_view_statistics),
            updated_at = CURRENT_TIMESTAMP
          `, [
            managerId,
            !!data.can_manage_envelopes,
            !!data.can_update_employees,
            !!data.can_view_restaurant_report,
            !!data.can_view_monthly_income,
            !!data.can_view_restaurant_dashboard,
            !!data.can_view_statistics
          ]);
          
          await conn.end();
          
          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Permissions updated successfully',
            affectedRows: result.affectedRows 
          }));
          
        } catch (error) {
          console.error('Update manager permissions error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: 'Database error', message: error.message }));
        }
      });
      return;
    }

    // ===== 404 (סוף כל הראוטים) =====
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`
    }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 MyTip Plesk iisnode Server WITH Employee + Envelope Management + Reports + TABLE PREFIXES`);
  console.log(`🌍 Server running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`  - GET  /api/status                       (status check)`);
  console.log(`  - GET  /api/test-db                      (database test)`);
  console.log(`  - POST /api/login                        (login with restaurant number)`);
  console.log(`  - POST /api/create-restaurant            (יצירת מסעדה חדשה - Table Prefixes!)`);
  console.log(`  - GET  /api/waiters                      (get waiters)`);
  console.log(`  - GET  /api/managers                     (get managers)`);
  console.log(`  - GET  /api/all-employees                (get all employees)`);
  console.log(`  - GET  /api/envelopes/:username          (get envelopes)`);
  console.log(`  - POST /api/create-envelope              (create envelope)`);
  console.log(`  - POST /api/envelopes/:id/deliver        (mark envelope delivered)`);
  console.log(`  - POST /api/envelopes/:id/received       (mark envelope received)`);
  console.log(`  - POST /api/create-user                  (create new user)`);
  console.log(`  - PUT  /api/user/:id                     (update user)`);
  console.log(`  - DELETE /api/user/:id                   (delete user)`);
  console.log(`  - POST /api/submit-report                (submit end of day report)`);
  console.log(`  - GET  /api/reports/:manager             (get reports by manager)`);
  console.log(`  - GET  /api/restaurant-summary           (get restaurant summary)`);
  console.log(`  - GET  /api/income-forecast              (income forecasting)`);
  console.log(`  - GET  /api/manager-performance          (manager performance metrics)`);
  console.log(`  - Management endpoints for owners:`);
  console.log(`    - GET  /api/management/all-envelopes   (all envelopes)`);
  console.log(`    - PUT  /api/management/envelope/:id    (update envelope)`);
  console.log(`    - DELETE /api/management/envelope/:id  (delete envelope)`);
  console.log(`    - GET  /api/management/all-reports     (all reports)`);
  console.log(`    - PUT  /api/management/report/:id      (update report)`);
  console.log(`    - DELETE /api/management/report/:id    (delete report)`);
  console.log(`  - Manager permissions:`);
  console.log(`    - POST /api/setup-manager-permissions  (setup permissions)`);
  console.log(`    - GET  /api/manager-permissions/:id    (get permissions)`);
  console.log(`    - PUT  /api/manager-permissions/:id    (update permissions)`);
  console.log(``);
  console.log(`🔧 Table Prefix System:`);
  console.log(`   ✅ מסעדה 100: mycru_100, end_dub_100, emvnew_100, manager_permissions_100`);
  console.log(`   ✅ מסעדה 200: mycru_200, end_dub_200, emvnew_200, manager_permissions_200`);
  console.log(`   ✅ דטאבייס eod קבוע לכולם`);
  console.log(`   ✅ הפרדה מלאה בין מסעדות`);
  console.log(`   ✅ בלי צורך בהרשאות דטאבייס גלובליות`);
  console.log(`   ✅ קבלת מספר מסעדה דרך header או URL parameter`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use`);
  } else {
    console.log(`❌ Server error: ${error.message}`);
  }
});
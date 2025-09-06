import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const WorkAgreementScreen = ({ navigation, route }) => {
  const { user } = route.params;
  const [employeeName, setEmployeeName] = useState(user?.realname || user?.wname || '');
  const [employeeId, setEmployeeId] = useState(user?.hisid || '');
  const [email, setEmail] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [criminalRecordConfirm, setCriminalRecordConfirm] = useState(false);
  const [pensionFund, setPensionFund] = useState('');
  const [loading, setLoading] = useState(false);

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('he-IL');
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('he-IL');
  };

  const handleSubmit = async () => {
    if (!employeeName.trim()) {
      Alert.alert('שגיאה', 'אנא הזן את השם המלא');
      return;
    }

    if (!employeeId.trim()) {
      Alert.alert('שגיאה', 'אנא הזן את מספר תעודת הזהות');
      return;
    }

    if (!email.trim()) {
      Alert.alert('שגיאה', 'אנא הזן כתובת דואר אלקטרוני');
      return;
    }

    if (!agreementAccepted) {
      Alert.alert('שגיאה', 'יש לאשר שקראת את ההסכם');
      return;
    }

    if (!criminalRecordConfirm) {
      Alert.alert('שגיאה', 'יש לאשר שאין לך עבר פלילי');
      return;
    }

    setLoading(true);

    try {
      // שליחת נתוני ההסכם לשרת
      const agreementData = {
        userId: user.id,
        employeeName: employeeName.trim(),
        employeeId: employeeId.trim(),
        email: email.trim(),
        pensionFund: pensionFund.trim(),
        signedDate: getCurrentDateTime(),
        agreementAccepted: true,
        criminalRecordConfirm: true
      };

      const result = await ApiService.submitWorkAgreement(agreementData);

      if (result.success) {
        // עדכן את המשתמש המקומי להיות מאושר
        const approvedUser = {
          ...user,
          aprove: 'yes'
        };
        
        // שמור את המשתמש המעודכן ב-AsyncStorage
        await AsyncStorage.setItem('currentUser', JSON.stringify(approvedUser));
        
        // שמור שההסכם נחתם מקומית
        const localAgreementKey = `work_agreement_${user.id}`;
        await AsyncStorage.setItem(localAgreementKey, JSON.stringify({
          signed: true,
          date: getCurrentDateTime(),
          employeeName: employeeName.trim(),
          email: email.trim()
        }));
        
        Alert.alert(
          '✅ הסכם נחתם בהצלחה!',
          'הסכם העבודה נשלח וזמין כעת במסד הנתונים.\nהחשבון שלך אושר והינך מחובר למערכת.',
          [
            {
              text: 'המשך למערכת הראשית',
              onPress: () => {
                // נווט ישירות למערכת עם המשתמש המאושר
                navigation.navigate('Dashboard', { user: approvedUser });
              }
            }
          ]
        );
      } else {
        Alert.alert('שגיאה', result.message || 'שגיאה בשמירת ההסכם');
      }
    } catch (error) {
      console.error('Error submitting work agreement:', error);
      Alert.alert('שגיאה', 'שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>הסכם עבודה</Text>
          <Text style={styles.headerSubtitle}>מסעדת דובנוב 8</Text>
        </View>

        <View style={styles.agreementContainer}>
          <Text style={styles.agreementTitle}>הודעה לעובד</Text>
          <Text style={styles.agreementSubtitle}>הודעה בדבר פירוט תנאי העבודה – מלצר</Text>
          
          <Text style={styles.agreementText}>
            לכבוד{'\n\n'}
            שם: {employeeName || '????? ??????'}{'\n\n'}
            ת.ז.: {employeeId || '888999000'}{'\n\n'}
            תחילת עבודה: {getCurrentDateTime()}{'\n\n'}
            
            האמור בהודעה זו בלשון זכר הינו לצורך הנוחות בלבד ויחול בהתאמה גם על נקבה.{'\n\n'}
            
            הואיל והינך מועסק במסעדת "דובנוב 8" (להלן: "המסעדה") אשר כתובתה היא: ברח' דובנוב 8 ת"א, המנוהלת על ידי חברת דובנוב מסעדות בע"מ ח.פ. 513506238 (להלן: "החברה"), הרינו להעלות על הכתב את תנאי העסקתך כדלקמן:{'\n\n'}
            
            1. תאריך תחילת העבודה: {getCurrentDateTime()} תקופת העבודה הינה בלתי קצובה וניתנת לסיום בהודעה מוקדמת כחוק.{'\n\n'}
            
            2. תשמש בתפקיד מלצר במסעדה. במידת הצורך, החברה רשאית לשבץ אותך למשמרות מסוימות בתפקידים אחרים ועבור ביצוע העבודה ישולם לך שכר בהתאם לתפקיד אליו תשובץ.{'\n\n'}
            
            3. הממונה הישיר עליך הינו מנהל המסעדה ו/או מטעמו (להלן: "הממונה").{'\n\n'}
            
            <Text style={styles.sectionTitle}>היקף העבודה</Text>{'\n\n'}
            
            4. שעות עבודה: לידיעתך, היקף משרה מלאה הוא 42 שעות שבועיות (לא כולל הפסקות). ככל שתעבוד במשרה מלאה, היום המקוצר שלך יהיה המשמרת האחרונה בשבוע. במידה ותחרוג ממסגרת זו – ישולם לך תשלום עבור עבודה בשעות נוספת במסגרת התוספת הגלובלית המפורטת בסעיף 7.2.1 להלן.{'\n\n'}
            
            5. מבלי לגרוע מן האמור בסעיף 4 לעיל, יובהר כי עבודתך תתבצע בימים ובשעות משתנים, בהתאם לסידור העבודה שייערך על ידי החברה, תוך התחשבות במידת האפשר, באילוציך. העבודה תתבצע בכל ימי השבוע, לרבות בסופי שבוע ובחגים ובשעות משתנות, לרבות בלילות, בהתאם לצרכיה המשתנים של החברה.{'\n\n'}
            
            <Text style={styles.sectionTitle}>רכיבי השכר</Text>{'\n\n'}
            
            6. בתקופת ההתלמדות תשלם לך החברה ישירות שכר בסך 34.32 ₪ נטו לשעה עבור כל שעת התלמדות. לאחר סיום ההתלמדות, החברה תשלם את שכר עבודתך, על כל רכיביו כמפורט בסעיף 7 להלן, מן התשר שתקבל מלקוחות המסעדה.{'\n\n'}
            
            7. רכיבי השכר שישולמו לך מן התשר הינם כמפורט להלן:{'\n\n'}
            
            7.1. שכר יסוד בסך של 34.32 ₪ ברוטו לשעה (להלן: "שכר היסוד").{'\n\n'}
            
            7.2. זכויות נלוות ברוטו כדלקמן (להלן: "הזכויות הנלוות"):{'\n\n'}
            
            7.2.1. תוספת גלובלית עבור עבודה בשעות נוספות בסך 14 ₪ ברוטו לשעת עבודה. תוספת זו תשולם לך עבור כל שעת עבודה והיא מחושבת בהסתמך על כך כי משרתך כוללת עבודה בשעות נוספות, וחושבה כך שתהווה, באופן מצטבר חודשי, תמורה שווה או גדולה מן החישוב האריתמטי בעד השעות הנוספות שתעבוד בכל חודש.{'\n\n'}
            
            7.2.2. דמי הבראה בסך של 1 ₪ ברוטו לשעת עבודה.{'\n\n'}
            
            7.2.3. החזר הוצאות נסיעה בסך של 5 ₪ ברוטו לשעת עבודה. יובהר כי לצורך חישוב גובה החזר הוצאות הנסיעה נלקח בחשבון גם החזר עבור הוצאות נסיעה בשעות ובמשמרות בהן לא קיימת תחבורה ציבורית בתעריף מוזל.{'\n\n'}
            
            7.2.4. בחתימתך על הודעה זו הינך מאשר ומסכים לכך כי כספי התשר ישמשו לתשלום הזכויות הנלוות המפורטות בסעיפים 7.2.1 -7.2.3 וברור ומובן לך כי כספי התשר ישמשו לתשלום גמול עבור עבודה בשעות נוספות, במנוחה השבועית ובחגים ולתשלום דמי הבראה והחזר הוצאות נסיעה.{'\n\n'}
            
            7.3. יתרת תשר – אם וככל שהתשר שישולם לך לשעה יעלה על שכר היסוד והזכויות הנלוות לשעה, כמפורט בסעיפים 7.1 ו-7.2 לעיל, תשולם לך יתרת התשר בתלוש השכר תחת הרכיב "יתרת תשר".{'\n\n'}
            
            7.4. הינך אחראי לקחת בסוף כל משמרת את כספי התשר. החברה אינה אחראית לכספים שלא נלקחו על ידך בסוף משמרת.{'\n\n'}
            
            <Text style={styles.sectionTitle}>התנהלות ביחס לתשר וניכויים</Text>{'\n\n'}
            
            8. מובהר בזאת כי כל הסכומים הקבועים בהודעה זו הינם סכומי ברוטו המגיעים לך בגין עבודתך במסעדה, והחברה תעביר את כל המיסים ותשלומי החובה האחרים שיחולו על ו/או שהנך חב או תחויב בהם ואשר חלה על החברה החובה לנכותם לפי דין.{'\n\n'}
            
            9. בהמשך לאמור לעיל, בחתימתך על הודעה זו הנך מתחייב, בסוף כל משמרת, להעביר לחברה 9 ₪ עבור כל שעת עבודה מסך התשר (כולל יתרת התשר) לשעה, בכפוף לשינויים מעת לעת. סכום זה כולל את ניכויי החובה החלים על העובד (ביטוח לאומי, ביטוח בריאות, מס הכנסה) וכן השתתפות בתשלומי החובה החלים על המעסיק.{'\n\n'}
            
            10. בחתימתך על הודעה זו הינך מאשר ומסכים לכך כי כספי התשר ישמשו להשתתפות בתשלומי החובה החלים על המעסיק כמפורט בסעיף 9 לעיל.{'\n\n'}
            
            11. במועד חתימך על הודעה זו החברה אינה מנכה מע"מ מן התשר. אם וככל שיחול שינוי במצב המשפטי בכל הנוגע למע"מ על התשר עצמו וככל שיקבע שיש לנכות מע"מ מן התשר או חלקו (לרבות שינוי חקיקה, פסיקה, נוהל או כיוצ"ב), תמסר לך הודעה לעובד מתוקנת בדבר ניכוי מע"מ.{'\n\n'}
            
            12. שכר היסוד והזכויות הנלוות, בניכוי המקדמות אשר תקבל מדי משמרת כמפורט לעיל, ישולמו לא יאוחר מן היום התשיעי בכל חודש, עבור החודש הקודם.{'\n\n'}
            
            13. הסכומים המפורטים לעיל יעודכנו בהתאם לעדכוני הדין מעת לעת בנוגע לשכר היסוד ולזכויות הנלוות.{'\n\n'}
            
            14. הסכמותיך למפורט בהודעה זו, הינן תנאי מוקדם לעבודתך בחברה, ולא תהיה זכאי לסכומים נוספים מעבר לקבוע בהודעה זו.{'\n\n'}
            
            15. למען הסר ספק, שכר היסוד ויתרת התשר בלבד הם השכר הקובע לחישוב זכויות העבודה שלך, לרבות פנסיה, דמי / פדיון חופשה, דמי מחלה, פיצויי פיטורים וכיוצ"ב.{'\n\n'}
            
            16. ביטוח פנסיוני ייערך על פי השיעורים והמועדים הקבועים בצו ההרחבה לביטוח פנסיוני מקיף במשק (להלן: "צו ההרחבה"). החברה תעביר את חלקה בהפרשות ותנכה משכרך את חלקך בהפרשות, כל זאת בשיעורים בהתאם לקבוע בצו ההרחבה.{'\n\n'}
            
            סוג התשלום: פנסיה; אחוז הפרשה של העובד: 6%; אחוז הפרשה של המעביד: 6.5% - תגמולים 6% - פיצויים; תאריך תחילת התשלום: {getCurrentDate()}; קרן הפנסיה: {pensionFund || '___________________'}.{'\n\n'}
            
            יובהר כי הפרשות העובד והמעביד לפנסיה יבוצעו משכר היסוד ויתרת התשר בלבד עבור עד 182 שעות.{'\n\n'}
            
            17. עליך להודיע לחברה את פרטי קרן הפנסיה לפי בחירתך לביצוע ההפרשות. במידה ולא תעשה כן – תעביר החברה את כספי הפנסיה לקרן ברירת מחדל.{'\n\n'}
            
            18. עליך להירשם בתכנה עם תחילת המשמרת ומיד עם סיומה. אי רישום הנוכחות תביא לכך שלא ישולם לך שכר בגין נוכחות בלתי מדווחת.{'\n\n'}
            
            19. צבירה וניצול של מחלה וחופשה יהיו על פי דין.{'\n\n'}
            
            20. יום המנוחה השבועי שלך הינו יום שבת. למען הסר ספק החברה רשאית להעסיקך במנוחה השבועית בהתאם להיתר העסקה בשבת בענף המסעדות.{'\n\n'}
            
            הודעה זו אינה הסכם עבודה אלא הודעת המעביד בדבר עיקר תנאי העבודה. אין באמור בהודעה זו כדי לגרוע מכל זכות מוקנית לך מכוח כל דין, צו הרחבה, הסכם קיבוצי, חוזה עבודה או חוזה אחר הנוגע לתנאי עבודתך.{'\n\n'}
            
            אנו מאחלים לך עבודה פורייה ונעימה.{'\n\n'}
          </Text>
        </View>

        {/* שדות פרטי העובד */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>פרטי העובד</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>שם העובד:</Text>
            <TextInput
              style={styles.textInput}
              value={employeeName}
              onChangeText={setEmployeeName}
              placeholder="הכנס שם מלא"
              textAlign="right"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>תעודת זהות:</Text>
            <TextInput
              style={styles.textInput}
              value={employeeId}
              onChangeText={setEmployeeId}
              placeholder="הכנס מספר תעודת זהות"
              keyboardType="numeric"
              textAlign="right"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>כתובת דואר אלקטרוני:</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="הכנס כתובת דואר אלקטרוני"
              keyboardType="email-address"
              textAlign="right"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>קרן פנסיה (אופציונלי):</Text>
            <TextInput
              style={styles.textInput}
              value={pensionFund}
              onChangeText={setPensionFund}
              placeholder="הכנס שם קרן הפנסיה"
              textAlign="right"
            />
          </View>

          <Text style={styles.formTitle}>אישור עובד</Text>
          
          <TouchableOpacity 
            style={[styles.checkboxContainer, agreementAccepted && styles.checkboxChecked]}
            onPress={() => setAgreementAccepted(!agreementAccepted)}
          >
            <Text style={[styles.checkboxText, agreementAccepted && styles.checkboxTextChecked]}>
              {agreementAccepted ? '✓' : '☐'} הנני מאשר שקראתי את ההסכם והבנתי את האמור בו ואני מסכים לתוכנו
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.checkboxContainer, criminalRecordConfirm && styles.checkboxChecked]}
            onPress={() => setCriminalRecordConfirm(!criminalRecordConfirm)}
          >
            <Text style={[styles.checkboxText, criminalRecordConfirm && styles.checkboxTextChecked]}>
              {criminalRecordConfirm ? '✓' : '☐'} הנני מצהיר כי אין לי כל עבר פלילי, או מניעה רפואית, חוקית או חוזית להעסקתי בחברה
            </Text>
          </TouchableOpacity>

          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>תאריך: {getCurrentDate()}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, (!agreementAccepted || !criminalRecordConfirm || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!agreementAccepted || !criminalRecordConfirm || loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'שומר הסכם...' : 'חתום על ההסכם'}
          </Text>
        </TouchableOpacity>

        <View style={styles.employerConfirmation}>
          <Text style={styles.employerTitle}>אישור מעסיק:</Text>
          <Text style={styles.employerText}>
            הנני מאשר כי ביום {getCurrentDateTime()} עובד {employeeName || '????? ??????'} חתם על האמור לעיל לאחר שאישר באפליקציה כי הוא מבין את אשר חותם עליו ומסכים לכל המפורט בו.{'\n\n'}
            דובנוב מסעדות בע"מ
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  scrollView: {
    flex: 1,
    padding: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
    backgroundColor: '#2c3e50',
    borderRadius: 15,
    marginHorizontal: -10
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#ecf0f1',
    textAlign: 'center'
  },
  agreementContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  agreementTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: 10
  },
  agreementSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#34495e',
    marginBottom: 20
  },
  agreementText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#2c3e50',
    textAlign: 'right'
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#2c3e50'
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center'
  },
  inputContainer: {
    marginBottom: 15
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'right'
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    textAlign: 'right'
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#f8f9fa'
  },
  checkboxChecked: {
    backgroundColor: '#e8f5e8',
    borderColor: '#27ae60'
  },
  checkboxText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    textAlign: 'right',
    flex: 1
  },
  checkboxTextChecked: {
    color: '#27ae60',
    fontWeight: '600'
  },
  dateContainer: {
    alignItems: 'center',
    marginTop: 15
  },
  dateText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
    shadowOpacity: 0
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  employerConfirmation: {
    backgroundColor: '#ecf0f1',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30
  },
  employerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center'
  },
  employerText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    textAlign: 'right'
  }
});

export default WorkAgreementScreen;
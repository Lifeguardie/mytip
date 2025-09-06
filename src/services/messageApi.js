const BASE_URL = 'https://api.dubnov8.com/api-simple.php';

class MessageApiService {
  
  // Get messages for a user
  static async getMessages(userId, type = 'all') {
    try {
      const response = await fetch(`${BASE_URL}/api/messages?userId=${userId}&type=${type}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, message: 'שגיאה בטעינת הודעות' };
    }
  }

  // Send a new message
  static async sendMessage(messageData) {
    try {
      const response = await fetch(`${BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, message: 'שגיאה בשליחת הודעה' };
    }
  }

  // Mark message as read
  static async markAsRead(messageId) {
    try {
      const response = await fetch(`${BASE_URL}/api/messages/${messageId}/read`, {
        method: 'POST'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return { success: false, message: 'שגיאה בעדכון הודעה' };
    }
  }

  // Get list of managers
  static async getManagers() {
    try {
      const response = await fetch(`${BASE_URL}/api/managers`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching managers:', error);
      return { success: false, message: 'שגיאה בטעינת מנהלים' };
    }
  }

  // Get unread message count
  static async getUnreadCount(userId) {
    try {
      const result = await this.getMessages(userId, 'received');
      if (result.success) {
        const unreadCount = result.messages?.filter(msg => !msg.is_read).length || 0;
        return { success: true, count: unreadCount };
      }
      return { success: false, count: 0 };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return { success: false, count: 0 };
    }
  }
}

export default MessageApiService;
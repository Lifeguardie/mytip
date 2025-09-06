import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ServerStatusAlert = ({ visible, onRetry, onClose }) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.alert}>
        <Text style={styles.title}>שגיאת חיבור לשרת</Text>
        <Text style={styles.message}>
          השרת לא זמין כרגע. זה יכול לקרות כאשר:
          {'\n'}• השרת במצב תחזוקה
          {'\n'}• יש בעיית רשת
          {'\n'}• השרת עמוס מדי
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>נסה שוב</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>סגור</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alert: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    margin: 20,
    minWidth: 300,
    maxWidth: '90%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#d32f2f',
    writingDirection: 'rtl',
  },
  message: {
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 20,
    lineHeight: 20,
    color: '#333',
    writingDirection: 'rtl',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
  },
  retryButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    writingDirection: 'rtl',
  },
  closeButton: {
    backgroundColor: '#757575',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
  },
  closeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    writingDirection: 'rtl',
  },
});

export default ServerStatusAlert;
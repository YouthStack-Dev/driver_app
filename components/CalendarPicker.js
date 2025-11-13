import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

export default function CalendarPicker({ visible, onClose, selectedDate, onSelectDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const changeMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const getCalendarDates = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const dates = [];
    
    // Add empty slots for days before the first day of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      dates.push({ empty: true });
    }
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day, 0, 0, 0, 0);
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const dateStr = `${dateYear}-${dateMonth}-${dayStr}`;
      
      dates.push({
        day,
        dateStr,
        date,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate
      });
    }
    
    return {
      dates,
      monthName: currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  };

  const handleDateSelect = (dateStr) => {
    onSelectDate(dateStr);
    onClose();
  };

  const handleQuickSelect = (daysOffset) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    handleDateSelect(dateStr);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.calendarContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Select Date</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButtonContainer}
            >
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.calendarBody}>
            {/* Month Navigation */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity 
                onPress={() => changeMonth(-1)}
                style={styles.monthNavButton}
              >
                <Text style={styles.monthNavIcon}>‹</Text>
              </TouchableOpacity>
              
              <Text style={styles.monthName}>{getCalendarDates().monthName}</Text>
              
              <TouchableOpacity 
                onPress={() => changeMonth(1)}
                style={styles.monthNavButton}
              >
                <Text style={styles.monthNavIcon}>›</Text>
              </TouchableOpacity>
            </View>
            
            {/* Day Headers */}
            <View style={styles.weekDaysRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <View key={index} style={styles.weekDayCell}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>
            
            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {getCalendarDates().dates.map((dateObj, index) => {
                if (dateObj.empty) {
                  return <View key={`empty-${index}`} style={styles.calendarCell} />;
                }
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarCell,
                      dateObj.isToday && !dateObj.isSelected && styles.todayCell,
                      dateObj.isSelected && styles.selectedCell
                    ]}
                    onPress={() => handleDateSelect(dateObj.dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      dateObj.isToday && !dateObj.isSelected && styles.todayText,
                      dateObj.isSelected && styles.selectedText
                    ]}>
                      {dateObj.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Select Buttons */}
            <View style={styles.quickSelectContainer}>
              <TouchableOpacity 
                style={styles.quickSelectButton}
                onPress={() => handleQuickSelect(0)}
              >
                <Text style={styles.quickSelectText}>Today</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickSelectButton}
                onPress={() => handleQuickSelect(1)}
              >
                <Text style={styles.quickSelectText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  closeButtonContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    fontSize: 18,
    color: '#636e72',
    fontWeight: '600',
  },
  calendarBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavIcon: {
    fontSize: 24,
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  monthName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b2bec3',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  todayCell: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
  },
  selectedCell: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
  },
  calendarDayText: {
    fontSize: 15,
    color: '#2d3436',
    fontWeight: '500',
  },
  todayText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  quickSelectContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6C63FF',
  },
  quickSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
  },
});

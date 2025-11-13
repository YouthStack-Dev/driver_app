import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { getWeekoffConfig } from '../services/weekoffService';

export default function CreateBookingScreen({ navigation }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectionMode, setSelectionMode] = useState('single'); // Changed default to 'single'
  
  // Single date selection
  const [selectedDates, setSelectedDates] = useState([]);
  
  // Range selection
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  const [weekoffDays, setWeekoffDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWeekoffConfig();
  }, []);

  const loadWeekoffConfig = async () => {
    setLoading(true);
    const result = await getWeekoffConfig();
    
    if (result.success) {
      setWeekoffDays(result.weekoffDays || []);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const isWeekoffDay = (date) => {
    const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()];
    return weekoffDays.includes(dayName);
  };

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date) => {
    return selectedDates.some(d => d.getTime() === date.getTime());
  };

  const isDateInRange = (date) => {
    if (!startDate || !endDate) return false;
    return date >= startDate && date <= endDate;
  };

  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const handleDateSelect = (day) => {
    // Create date in local timezone at midnight
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 0, 0, 0, 0);
    
    if (isPastDate(date) || isWeekoffDay(date)) {
      return;
    }

    if (selectionMode === 'single') {
      // Toggle single date selection
      const isSelected = isDateSelected(date);
      if (isSelected) {
        setSelectedDates(selectedDates.filter(d => d.getTime() !== date.getTime()));
      } else {
        setSelectedDates([...selectedDates, date]);
      }
    } else {
      // Range selection logic
      if (!startDate || (startDate && endDate)) {
        setStartDate(date);
        setEndDate(null);
      } else if (startDate && !endDate) {
        if (date < startDate) {
          setEndDate(startDate);
          setStartDate(date);
        } else {
          setEndDate(date);
        }
      }
    }
  };

  const clearSelection = () => {
    setSelectedDates([]);
    setStartDate(null);
    setEndDate(null);
  };

  const switchMode = (mode) => {
    clearSelection();
    setSelectionMode(mode);
  };

  const getWorkingDaysCount = () => {
    if (selectionMode === 'single') {
      return selectedDates.length;
    } else {
      if (!startDate || !endDate) return startDate ? 1 : 0;
      
      let count = 0;
      let current = new Date(startDate);
      
      while (current <= endDate) {
        if (!isWeekoffDay(current)) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      
      return count;
    }
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const weeks = [];
    let days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const isWeekoff = isWeekoffDay(date);
      const isPast = isPastDate(date);
      
      let isSelected = false;
      let isStart = false;
      let isEnd = false;
      let inRange = false;
      
      if (selectionMode === 'single') {
        isSelected = isDateSelected(date);
      } else {
        isStart = startDate && date.getTime() === startDate.getTime();
        isEnd = endDate && date.getTime() === endDate.getTime();
        inRange = isDateInRange(date);
      }
      
      const isDisabled = isWeekoff || isPast;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            selectionMode === 'single' && isSelected && styles.selectedDay,
            selectionMode === 'range' && isStart && styles.startDay,
            selectionMode === 'range' && isEnd && styles.endDay,
            selectionMode === 'range' && inRange && !isStart && !isEnd && !isWeekoff && styles.rangeDay,
            isDisabled && styles.disabledDay,
          ]}
          onPress={() => handleDateSelect(day)}
          disabled={isDisabled}
        >
          <Text style={[
            styles.dayText,
            (isSelected || isStart || isEnd) && styles.selectedDayText,
            selectionMode === 'range' && inRange && !isStart && !isEnd && !isWeekoff && styles.rangeDayText,
            isDisabled && styles.disabledDayText,
          ]}>
            {day}
          </Text>
          {isWeekoff && !isPast && ((selectionMode === 'range' && inRange) || selectionMode === 'single') && (
            <View style={styles.weekoffDot} />
          )}
        </TouchableOpacity>
      );

      if ((startingDayOfWeek + day) % 7 === 0) {
        weeks.push(
          <View key={`week-${weeks.length}`} style={styles.weekRow}>
            {days}
          </View>
        );
        days = [];
      }
    }

    if (days.length > 0) {
      while (days.length < 7) {
        days.push(<View key={`empty-end-${days.length}`} style={styles.dayCell} />);
      }
      weeks.push(
        <View key={`week-${weeks.length}`} style={styles.weekRow}>
          {days}
        </View>
      );
    }

    return weeks;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  const workingDaysCount = getWorkingDaysCount();
  const hasValidSelection = selectionMode === 'single' ? selectedDates.length > 0 : (startDate && endDate);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Booking Dates</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Mode Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectionMode === 'single' && styles.activeTab]}
          onPress={() => switchMode('single')}
        >
          <Text style={[styles.tabText, selectionMode === 'single' && styles.activeTabText]}>
            Specific Dates
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectionMode === 'range' && styles.activeTab]}
          onPress={() => switchMode('range')}
        >
          <Text style={[styles.tabText, selectionMode === 'range' && styles.activeTabText]}>
            Date Range
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode Description */}
      <View style={styles.modeDescription}>
        <Text style={styles.modeDescText}>
          {selectionMode === 'single' 
            ? 'Tap multiple dates to select specific days (e.g., 12th, 18th, 26th)'
            : 'Tap to select start and end dates for continuous booking'}
        </Text>
      </View>

      <View style={styles.calendarCard}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.weekRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <View key={day} style={styles.dayCell}>
              <Text style={styles.dayHeader}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        {renderCalendar()}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.weekoffLegend]} />
            <Text style={styles.legendText}>Weekoff</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, styles.selectedLegend]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
          {selectionMode === 'range' && (
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.rangeLegend]} />
              <Text style={styles.legendText}>In Range</Text>
            </View>
          )}
        </View>
      </View>

      {/* Selected Dates Info */}
      {hasValidSelection && (
        <View style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionLabel}>
              {selectionMode === 'single' ? 'Selected Dates:' : 'Selected Range:'}
            </Text>
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          {selectionMode === 'single' ? (
            <>
              {selectedDates.sort((a, b) => a - b).map((date, index) => (
                <Text key={index} style={styles.selectionDate}>
                  • {date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              ))}
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {workingDaysCount} day{workingDaysCount !== 1 ? 's' : ''} selected
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.selectionDate}>
                From: {startDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              {endDate ? (
                <>
                  <Text style={styles.selectionDate}>
                    To: {endDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {workingDaysCount} working day{workingDaysCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.hintText}>Tap another date to complete range</Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, !hasValidSelection && styles.continueButtonDisabled]}
        disabled={!hasValidSelection}
        onPress={() => {
          const bookingData = {
            selectionMode,
            selectedDates: selectionMode === 'single' ? selectedDates.map(d => {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }) : null,
            startDate: selectionMode === 'range' ? (() => {
              const year = startDate.getFullYear();
              const month = String(startDate.getMonth() + 1).padStart(2, '0');
              const day = String(startDate.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })() : null,
            endDate: selectionMode === 'range' ? (() => {
              const year = endDate.getFullYear();
              const month = String(endDate.getMonth() + 1).padStart(2, '0');
              const day = String(endDate.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })() : null,
            daysCount: workingDaysCount,
          };
          console.log('Navigating to shift selection with:', bookingData);
          navigation.navigate('SelectShift', bookingData);
        }}
      >
        <Text style={styles.continueButtonText}>
          {hasValidSelection 
            ? `Continue with ${workingDaysCount} day${workingDaysCount !== 1 ? 's' : ''}` 
            : 'Select Date(s)'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#636e72',
  },
  header: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  errorText: {
    color: '#d63031',
    fontSize: 14,
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#6C63FF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#636e72',
  },
  activeTabText: {
    color: '#fff',
  },
  modeDescription: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF',
  },
  modeDescText: {
    fontSize: 13,
    color: '#636e72',
    lineHeight: 18,
  },
  calendarCard: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  navButton: {
    padding: 10,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 24,
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
    flex: 1,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: '13%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderRadius: 8,
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#636e72',
  },
  dayText: {
    fontSize: 14,
    color: '#2d3436',
  },
  selectedDay: {
    backgroundColor: '#6C63FF',
  },
  startDay: {
    backgroundColor: '#6C63FF',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  endDay: {
    backgroundColor: '#6C63FF',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  rangeDay: {
    backgroundColor: '#E8E6FF',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rangeDayText: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  disabledDay: {
    backgroundColor: '#f5f5f5',
  },
  disabledDayText: {
    color: '#b2bec3',
    textDecorationLine: 'line-through',
  },
  weekoffDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d63031',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  weekoffLegend: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d63031',
  },
  selectedLegend: {
    backgroundColor: '#6C63FF',
  },
  rangeLegend: {
    backgroundColor: '#E8E6FF',
  },
  legendText: {
    fontSize: 12,
    color: '#636e72',
  },
  selectionCard: {
    backgroundColor: '#f0efff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6C63FF',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectionLabel: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d63031',
  },
  clearButtonText: {
    color: '#d63031',
    fontSize: 12,
    fontWeight: '600',
  },
  selectionDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 5,
  },
  hintText: {
    fontSize: 13,
    color: '#636e72',
    fontStyle: 'italic',
    marginTop: 5,
  },
  countBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6C63FF',
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  countText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#6C63FF',
    margin: 15,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#b2bec3',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

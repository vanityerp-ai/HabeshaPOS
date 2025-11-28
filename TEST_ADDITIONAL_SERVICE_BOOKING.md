# Test Plan for Additional Service Booking Functionality

## Overview
This document outlines the test scenarios to verify that the additional service booking functionality works correctly in the service started tab.

## Test Scenarios

### 1. Adding Single Additional Service
**Objective:** Verify that a single additional service can be added and persists correctly.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Select a service category
5. Select a service
6. Select a staff member
7. Click "Add Service"
8. Verify the service appears in the booking items list
9. Verify the service persists after page refresh
10. Verify the service appears in the calendar grid for the assigned staff

**Expected Results:**
- Service is added to the booking
- Service persists after refresh
- Service appears in calendar grid
- Staff is marked as unavailable during the service time

### 2. Adding Multiple Additional Services
**Objective:** Verify that multiple additional services can be added to the same booking.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Add first service with staff member A
5. Click "Add Service" button again
6. Add second service with staff member B
7. Click "Add Service" button again
8. Add third service with staff member C
9. Verify all three services appear in the booking items list
10. Verify all services persist after page refresh
11. Verify all services appear in the calendar grid for their respective staff

**Expected Results:**
- All services are added to the booking
- All services persist after refresh
- All services appear in calendar grid
- Each staff member is marked as unavailable during their respective service time

### 3. Different Staff Assignments
**Objective:** Verify that services can be assigned to different staff members.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Add service with staff member A
5. Click "Add Service" button again
6. Add service with staff member B
7. Click "Add Service" button again
8. Add service with staff member C
9. Verify each service is assigned to the correct staff member
10. Verify staff availability is correctly updated in the calendar

**Expected Results:**
- Each service is assigned to the correct staff member
- Staff availability is correctly reflected in the calendar
- No conflicts between different staff assignments

### 4. Various Booking Durations
**Objective:** Verify that services with different durations are handled correctly.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Add service with 30-minute duration
5. Click "Add Service" button again
6. Add service with 60-minute duration
7. Click "Add Service" button again
8. Add service with 90-minute duration
9. Verify each service duration is correctly displayed
10. Verify staff availability is correctly updated for each duration

**Expected Results:**
- Each service duration is correctly displayed
- Staff availability is correctly updated for each duration
- Calendar grid accurately reflects the time blocks for each service

### 5. Completion of Parent Booking
**Objective:** Verify that when parent booking is completed, staff assigned to additional services correctly return to available status.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Add additional service with staff member A
5. Verify staff member A is unavailable in the calendar
6. Click "Complete" button for the parent booking
7. Verify the booking moves to the completed tab
8. Navigate to the calendar view
9. Verify staff member A is now available

**Expected Results:**
- Parent booking completes successfully
- Staff member A returns to available status
- Calendar correctly reflects staff availability

### 6. Staff Service Completion
**Objective:** Verify that individual staff services can be marked as completed.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Add additional service with staff member A
5. Verify staff member A is unavailable in the calendar
6. Click the "Complete" button next to the additional service
7. Verify the service is marked as completed
8. Verify staff member A returns to available status
9. Verify the parent booking remains in service-started status

**Expected Results:**
- Additional service is marked as completed
- Staff member A returns to available status
- Parent booking remains in service-started status
- Calendar correctly reflects staff availability

### 7. Deleting Additional Services
**Objective:** Verify that additional services can be deleted and staff availability is updated.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Add additional service with staff member A
5. Verify staff member A is unavailable in the calendar
6. Click the delete button for the additional service
7. Confirm deletion
8. Verify the service is removed from the booking
9. Verify staff member A returns to available status
10. Verify the calendar reflects the updated availability

**Expected Results:**
- Additional service is removed from the booking
- Staff member A returns to available status
- Calendar correctly reflects staff availability

### 8. Error Handling
**Objective:** Verify that appropriate error handling is in place.

**Steps:**
1. Navigate to the service started tab
2. Select a booking
3. Click "Add Service" button
4. Try to add a service without selecting required fields
5. Verify appropriate error messages are displayed
6. Try to delete the only service in a booking
7. Verify the action is prevented with appropriate messaging

**Expected Results:**
- Appropriate error messages are displayed for invalid inputs
- Actions that would create inconsistent states are prevented
- Error logging captures relevant information for troubleshooting

## Verification Points

### Frontend Display
- Additional service records persist after initial display
- Services appear correctly in the booking summary
- Services appear in the calendar grid for assigned staff
- Staff availability is correctly indicated

### Backend Persistence
- Additional service bookings are properly stored in the database
- Staff assignments are correctly persisted
- Service details (name, duration, price) are correctly stored

### State Management
- Staff return to available status when services are completed
- Calendar grid behavior is consistent
- Booking completion handling works correctly
- Synchronization between parent and additional bookings is maintained

### Error Handling
- Proper error logging is implemented
- Validation prevents inconsistent states
- User-friendly error messages are displayed
- Edge cases are handled gracefully

## Success Criteria
All test scenarios pass with:
- No data loss
- Consistent UI behavior
- Correct staff availability updates
- Proper error handling
- Smooth user experience
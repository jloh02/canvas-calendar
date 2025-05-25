# Canvas Calendar
A simple Google App Script to filter Canvas' calendar using a regex ([Regular Expression](https://regexr.com/)) set

## Rationale
- Many institutions use Canvas as a Learning Management System (LMS)
- Some restrict the API, disallowing querying of courses by API
- The calendar feed is often filled with lots of events we don't attend such as specific timeslots, ~~lectures~~, irrelevant assignments, but we still want the calendar to keep important deadlines, events, and more

## Getting Started

### 1. Canvas
(Instructions may change based on Canvas version)
- Sign-In to your school's Canvas system (For NUS, it's https://canvas.nus.edu.sg/calendar)
- Click on Calendar Feed (Bottom-right of the page)
- Copy the full .ics link. This is your `ICS_URL`.

### 2. Google Calendar
- Create a new Google Calendar at https://calendar.google.com/calendar/u/0/r/settings/createcalendar
    - If this link breaks go to Google Calendar > Other Calendars > Add New Calendar > Create New Calendar
- Enter details accordingly and Create
- Find this calendar you created and its ID
    - This can be found by scrolling to "Integrate calendar" subsection on the calendar's page
- Note down this as the `CALENDAR_ID`


### 3. Automating Using Google Apps Script
- Create an Apps Script Project at https://script.google.com/home

#### 3a. Edit the Code File
- Copy the `Code.js` contents into `Code.gs` (.gs is essentially Google's JavaScript)
- Update with `ICS_URL` and `CALENDAR_ID`
- Update RegExes in `FILTER_TITLE_PATTERNS` with patterns of titles you do not want
    - If you need help, you can use [RegExr](https://regexr.com/) to test expressions, or just ChatGPT and test 
    - You can leave it empty to test the importing
- Click run on `syncCanvasICSToGoogleCalendar` to test

#### 3b. Setup Trigger
- On the left sidebar, select "Triggers"
- Click "Add Trigger" (Button floating on the bottom right)
  - Function: `syncCanvasICSToGoogleCalendar`
  - Deployment: head
  - Event source: Time-Driven
  - Type and Frequency: how ever often you want to update (I chose every hour)
  - Failure Notification: Notify me daily (Choose as you wish)
  - Click `Save`!

#### 3c. Test or Not?
- You can test it by running the `syncCanvasICSToGoogleCalendar` function in the editor again
- Or trust that my code works, your regex and setting up is flawless and that your calendar is now synced!

## Other Utilities
- You can run the `deleteAllCalendarEvents` function to reset the calendar when the code goes wonky 
    - This shouldn't need to be done frequently
    - You can also run this once daily on a trigger, the code will account for it

## Contributing
You can contribute by creating a pull request which
- Edits `Code.js`
- Updates this documentation
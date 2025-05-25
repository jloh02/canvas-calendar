const ICS_URL = ""; // Replace with your Canvas ICS link (e.g. https://canvas.abcdef.com/feeds/calendars/user_fPRIOCvVbmq9PFbZXhsTnO5liIjnFIqloVsFCDl2.ics)
const CALENDAR_ID = ""; // Replace with your calendar link (e.g. b8267e54b1dbb82269dd8e4c3d0dd53c5cc66e7557c7ac7068b1cfd943fc4e33@group.calendar.google.com)

// Replace with suitable regexes
const FILTER_TITLE_PATTERNS = [
  /IS2218 Digital Platforms for Business \[2420\]/,
  /CS2107/,
  /EL1101E Office Hours/,
  /^[A-Z]+(?:\s+[A-Z]+)*$/          
];
// Last line disallows all capitalized names (e.g. SOME_COURSE_EVENT) due to one of my courses being strange and not having course code

const START_DATE = new Date(1970, 0, 1);
const FUTURE_DATE = new Date(2100, 11, 31);

function syncCanvasICSToGoogleCalendar() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const existingEvents = getExistingEvents(calendar);
  const icsEvents = parseCanvasICS();

  const updatedEventIds = new Set();

  icsEvents.forEach(event => {
    Logger.log(event);

    const gcalEvent = existingEvents[event.uid];

    if (gcalEvent) {
      // Update existing event
      updateGoogleCalendarEvent(gcalEvent, event);
    } else {
      // Add new event
      addGoogleCalendarEvent(calendar, event);
    }
    updatedEventIds.add(event.uid);
  });

  // Remove events from Google Calendar that no longer exist in ICS
  removeDeletedEvents(calendar, existingEvents, updatedEventIds);
}

// Parse the ICS file
function parseCanvasICS() {
  const response = UrlFetchApp.fetch(ICS_URL);
  const icsText = response.getContentText();

  const events = [];
  const regex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = regex.exec(icsText)) !== null) {
    const eventText = match[1];

    const uid = extractField(eventText, "UID");
    const summary = extractField(eventText, "SUMMARY", true);
    const start = extractField(eventText, "DTSTART");
    const end = extractField(eventText, "DTEND");
    const location = extractField(eventText, "LOCATION", true);
    const description = extractField(eventText, "X-ALT-DESC", true);

    const { startDate, endDate, isAllDay } = parseStartEndTimes(start, end);

    if (!isSummaryAllowed(summary)) {
      Logger.log("Ignoring: " + summary);
      continue;
    }

    if (!startDate || !endDate) {
      Logger.log(`Invalid dates: ${summary} ${startDate} ${endDate}`)
      continue;
    }

    events.push({
      uid,
      summary,
      start: startDate,
      end: endDate,
      location,
      description,
      allDay: isAllDay,
    });
  }

  return events;
}

function isSummaryAllowed(text) {
  return !FILTER_TITLE_PATTERNS.some(pattern => pattern.test(text));
}

// Get existing events from Google Calendar
function getExistingEvents(calendar) {
  const allEvents = calendar.getEvents(START_DATE, FUTURE_DATE);
  const eventMap = {};

  allEvents.forEach(event => {
    const uid = event.getTag("canvas_uid"); // Retrieve stored UID
    if (uid) eventMap[uid] = event;
  });

  return eventMap;
}

// Add new event to Google Calendar
function addGoogleCalendarEvent(calendar, event) {
  let newEvent;
  if (event.allDay)
    newEvent = calendar.createEvent(event.summary, new Date(event.start), new Date(event.end), {
      location: event.location,
      description: event.description
    });
  else {
    newEvent = calendar.createAllDayEvent(event.summary, new Date(event.start), {
      location: event.location,
      description: event.description
    });
  }

  newEvent.setTag("canvas_uid", event.uid); // Store UID in a hidden field
  Logger.log("Added event: " + event.summary);
}

// Update existing event in Google Calendar
function updateGoogleCalendarEvent(gcalEvent, event) {
  let needsUpdate = false;

  if (gcalEvent.getTitle() !== event.summary) {
    gcalEvent.setTitle(event.summary);
    needsUpdate = true;
  }

  const sameAllDayType = gcalEvent.isAllDayEvent() === event.allDay;
  if (event.allDay) {
    if (!sameAllDayType || gcalEvent.getAllDayStartDate().toISOString() !== new Date(event.start).toISOString() ||
      gcalEvent.getAllDayEndDate().toISOString() !== new Date(event.end).toISOString()) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (start.toISOString() === end.toISOString()) gcalEvent.setAllDayDate(start);
      else gcalEvent.setAllDayDates(start, end);
      needsUpdate = true;
    }
  } else {
    if (!sameAllDayType || gcalEvent.getStartTime().toISOString() !== new Date(event.start).toISOString() ||
      gcalEvent.getEndTime().toISOString() !== new Date(event.end).toISOString()) {
      gcalEvent.setTime(new Date(event.start), new Date(event.end));
      needsUpdate = true;
    }
  }

  if (gcalEvent.getLocation() !== event.location) {
    gcalEvent.setLocation(event.location);
    needsUpdate = true;
  }

  if (gcalEvent.getDescription() !== event.description) {
    gcalEvent.setDescription(event.description);
    needsUpdate = true;
  }

  if (needsUpdate) {
    Logger.log("Updated event: " + event.summary);
  }
}

// Remove deleted events from Google Calendar
function removeDeletedEvents(calendar, existingEvents, updatedEventIds) {
  Object.keys(existingEvents).forEach(uid => {
    if (!updatedEventIds.has(uid)) {
      existingEvents[uid].deleteEvent();
      Logger.log("Deleted event: " + existingEvents[uid].getTitle());
    }
  });
}

function extractField(eventText, fieldName, isEscapedText = false) {
  //After first line with header, take all subsequent lines with a space in front.
  const regex = new RegExp(`${fieldName}.*?:((.*)(?:\r?\n .*)*)`, 'gim');
  const match = regex.exec(eventText);
  let result = match ? match[1].trim().replace(/\r?\n /g, "") : "";
  if (isEscapedText) {
    result = result
      .replace(/\\;/g, ";")
      .replace(/\\n/g, "\n")
      .replace(/\\'/g, "\'")
      .replace(/\\"/g, '\"')
      .replace(/\\&/g, "\&")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\,/g, ",")
      .replace(/\\ /g, " ");
  }
  return result;
}

// Helper function to parse start and end times and determine if it's an all-day event
function parseStartEndTimes(startTime, endTime) {
  const isAllDay = Boolean(!endTime);

  const start = formatICSTime(startTime);
  let end = isAllDay ? new Date(start) : formatICSTime(endTime);

  return { startDate: start, endDate: end, isAllDay };
}

// Helper function to format ICS timestamps into a valid JavaScript Date
function formatICSTime(icsTime) {
  if (!icsTime) {
    Logger.log("Empty ICS Time: " + icsTime);
    return;
  }

  // Case 1: Format when time is included (e.g., '20250411T070000Z')
  let timeWithTimeRegex = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
  let match = icsTime.match(timeWithTimeRegex);

  if (match) {
    let formattedTime = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;  // '2025-04-11T07:00:00Z'
    return new Date(formattedTime);
  }

  // Case 2: Format when only date is provided (e.g., '20250411')
  let timeWithoutTimeRegex = /^(\d{4})(\d{2})(\d{2})$/;
  match = icsTime.match(timeWithoutTimeRegex);

  if (match) {
    let formattedTime = `${match[1]}-${match[2]}-${match[3]}T00:00:00Z`;  // '2025-04-11T00:00:00Z'
    return new Date(formattedTime);
  }

  Logger.log("Invalid date format: " + icsTime);
}


function deleteAllCalendarEvents() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const existingEvents = calendar.getEvents(START_DATE, FUTURE_DATE);

  existingEvents.forEach(event => {
    event.deleteEvent();
  });
}
